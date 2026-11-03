import {
  Injectable, BadRequestException, Logger, ForbiddenException, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Razorpay from 'razorpay';
import * as crypto from 'crypto';
import { Payment } from './payment.entity';
import { PaymentStatus } from '../common/enums';
import { Role } from '../common/enums';
import { User } from '../users/user.entity';
import { ServiceRequest } from '../service-requests/entities/service-request.entity';
import { QuoteItem } from '../quotes/quote-item.entity';

interface CreateOrderDto {
  serviceRequestId: string;
  amount: number; // in INR (will be converted to paise)
  isAdvance?: boolean;
}

@Injectable()
export class PaymentsService {
  private readonly razorpay: Razorpay;
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    @InjectRepository(ServiceRequest) private srRepo: Repository<ServiceRequest>,
    @InjectRepository(QuoteItem) private quoteRepo: Repository<QuoteItem>,
    private config: ConfigService,
  ) {
    this.razorpay = new Razorpay({
      key_id: this.config.get('RAZORPAY_KEY_ID'),
      key_secret: this.config.get('RAZORPAY_KEY_SECRET'),
    });
  }

  private async assertRequestAccess(serviceRequestId: string, user: User) {
    const request = await this.srRepo.findOne({ where: { id: serviceRequestId } });
    if (!request) throw new NotFoundException('Service request not found');
    if (user.role === Role.CUSTOMER && request.customerId !== user.id) throw new ForbiddenException();
    if (![Role.CUSTOMER, Role.SUPER_ADMIN, Role.OPERATIONS].includes(user.role)) throw new ForbiddenException();
    return request;
  }

  private async outstandingAmount(serviceRequestId: string) {
    const items = await this.quoteRepo.find({ where: { serviceRequestId } });
    if (!items.length) throw new BadRequestException('A quotation is required before payment');
    const quoted = +items.reduce((sum, item) => sum + Number(item.total) * (1 + Number(item.taxRate) / 100), 0).toFixed(2);
    const paid = await this.paymentRepo.find({ where: { serviceRequestId, status: PaymentStatus.CAPTURED } });
    return +(quoted - paid.reduce((sum, payment) => sum + Number(payment.amount), 0)).toFixed(2);
  }

  async createOrder(dto: CreateOrderDto, user: User) {
    const request = await this.assertRequestAccess(dto.serviceRequestId, user);
    if (user.role === Role.CUSTOMER && !request.quoteApproved) throw new BadRequestException('Approve the quotation before payment');
    if (user.role === Role.CUSTOMER && dto.isAdvance) throw new ForbiddenException('Advance payments must be arranged by staff');
    const outstanding = await this.outstandingAmount(dto.serviceRequestId);
    if (outstanding <= 0) throw new BadRequestException('This quotation has already been paid');
    const amount = dto.isAdvance ? dto.amount : outstanding;
    if (amount > outstanding || (!dto.isAdvance && Math.abs(dto.amount - outstanding) > 0.01)) {
      throw new BadRequestException('Payment amount does not match the outstanding quotation');
    }
    const amountPaise = Math.round(amount * 100);
    const pending = await this.paymentRepo.findOne({
      where: { serviceRequestId: dto.serviceRequestId, status: PaymentStatus.PENDING },
      order: { createdAt: 'DESC' },
    });
    if (pending?.razorpayOrderId) {
      if (Math.abs(Number(pending.amount) - amount) > 0.01) throw new BadRequestException('A different payment is already pending for this request');
      return { orderId: pending.razorpayOrderId, amount: amountPaise, currency: 'INR', paymentId: pending.id };
    }

    const order = await this.razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: `VFX-${dto.serviceRequestId.slice(0, 8)}`,
      notes: {
        serviceRequestId: dto.serviceRequestId,
        isAdvance: String(dto.isAdvance ?? false),
      },
    });

    const payment = this.paymentRepo.create({
      serviceRequestId: dto.serviceRequestId,
      razorpayOrderId: order.id,
      amount,
      status: PaymentStatus.PENDING,
      isAdvance: dto.isAdvance ?? false,
    });
    let savedPayment = payment;
    try {
      savedPayment = await this.paymentRepo.save(payment);
    } catch (error: any) {
      if (error?.code !== '23505') throw error;
      const winner = await this.paymentRepo.findOne({
        where: { serviceRequestId: dto.serviceRequestId, status: PaymentStatus.PENDING },
      });
      if (!winner?.razorpayOrderId || Math.abs(Number(winner.amount) - amount) > 0.01) throw error;
      return { orderId: winner.razorpayOrderId, amount: amountPaise, currency: 'INR', paymentId: winner.id };
    }

    return { orderId: order.id, amount: amountPaise, currency: 'INR', paymentId: savedPayment.id };
  }

  async verifyWebhook(body: Buffer, signature: string): Promise<void> {
    const webhookSecret = this.config.getOrThrow<string>('RAZORPAY_WEBHOOK_SECRET');
    const digest = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex');

    const actual = Buffer.from(signature ?? '', 'utf8');
    const expected = Buffer.from(digest, 'utf8');
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
      throw new BadRequestException('Invalid webhook signature');
    }
  }

  async handlePaymentCaptured(payload: any) {
    const entity = payload?.payment?.entity;
    const { order_id, id: payment_id, method, amount, currency } = entity ?? {};
    const payment = await this.paymentRepo.findOne({ where: { razorpayOrderId: order_id } });
    if (!payment) throw new BadRequestException('Unknown payment order');
    if (currency !== 'INR' || Number(amount) !== Math.round(Number(payment.amount) * 100)) {
      this.logger.error(`Rejected mismatched capture for order ${order_id}`);
      throw new BadRequestException('Payment details do not match the order');
    }
    await this.paymentRepo.update(payment.id, {
      razorpayPaymentId: payment_id,
      method,
      status: PaymentStatus.CAPTURED,
    });
    this.logger.log(`Payment captured: ${payment_id} for order ${order_id}`);
  }

  async handlePaymentFailed(payload: any) {
    const { order_id } = payload.payment.entity;
    await this.paymentRepo.update(
      { razorpayOrderId: order_id },
      { status: PaymentStatus.FAILED },
    );
    this.logger.warn(`Payment failed for order ${order_id}`);
  }

  async initiateRefund(serviceRequestId: string, paymentId: string) {
    const payment = await this.paymentRepo.findOne({ where: { id: paymentId, serviceRequestId } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== PaymentStatus.CAPTURED || !payment.razorpayPaymentId) throw new BadRequestException('Only captured payments can be refunded');
    await this.razorpay.payments.refund(payment.razorpayPaymentId, {
      amount: Math.round(+payment.amount * 100),
    });
    await this.paymentRepo.update(paymentId, { status: PaymentStatus.REFUNDED });
    return { message: 'Refund initiated' };
  }

  async findByServiceRequest(serviceRequestId: string, user: User) {
    await this.assertRequestAccess(serviceRequestId, user);
    return this.paymentRepo.find({ where: { serviceRequestId } });
  }
}
