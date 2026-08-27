import {
  Injectable, BadRequestException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Razorpay from 'razorpay';
import * as crypto from 'crypto';
import { Payment } from './payment.entity';
import { PaymentStatus } from '../common/enums';

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
    private config: ConfigService,
  ) {
    this.razorpay = new Razorpay({
      key_id: this.config.get('RAZORPAY_KEY_ID'),
      key_secret: this.config.get('RAZORPAY_KEY_SECRET'),
    });
  }

  async createOrder(dto: CreateOrderDto) {
    const amountPaise = Math.round(dto.amount * 100);

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
      amount: dto.amount,
      status: PaymentStatus.PENDING,
      isAdvance: dto.isAdvance ?? false,
    });
    await this.paymentRepo.save(payment);

    return { orderId: order.id, amount: amountPaise, currency: 'INR', payment };
  }

  async verifyWebhook(body: Buffer, signature: string): Promise<void> {
    const webhookSecret = this.config.get('RAZORPAY_WEBHOOK_SECRET');
    const digest = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex');

    if (digest !== signature) {
      throw new BadRequestException('Invalid webhook signature');
    }
  }

  async handlePaymentCaptured(payload: any) {
    const { order_id, id: payment_id, method } = payload.payment.entity;
    await this.paymentRepo.update(
      { razorpayOrderId: order_id },
      {
        razorpayPaymentId: payment_id,
        method,
        status: PaymentStatus.CAPTURED,
      },
    );
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

  async initiateRefund(paymentId: string) {
    const payment = await this.paymentRepo.findOneOrFail({ where: { id: paymentId } });
    await this.razorpay.payments.refund(payment.razorpayPaymentId, {
      amount: Math.round(+payment.amount * 100),
    });
    await this.paymentRepo.update(paymentId, { status: PaymentStatus.REFUNDED });
    return { message: 'Refund initiated' };
  }

  async findByServiceRequest(serviceRequestId: string) {
    return this.paymentRepo.find({ where: { serviceRequestId } });
  }
}
