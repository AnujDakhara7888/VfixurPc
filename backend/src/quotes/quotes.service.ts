import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/user.entity';
import { Role } from '../common/enums';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { QuoteItem } from './quote-item.entity';
import { CreateQuoteDto } from './dto/quote.dto';
import { ServiceRequest } from '../service-requests/entities/service-request.entity';
import { StatusHistory } from '../service-requests/entities/status-history.entity';
import { ServiceRequestStatus } from '../common/enums';
import { Offer } from '../offers/offer.entity';
import { Booking } from '../service-requests/entities/booking.entity';

const DIAGNOSIS_FEE = 500; // INR incl. GST
const GST_RATE = 18; // 9% CGST + 9% SGST

@Injectable()
export class QuotesService {
  constructor(
    @InjectRepository(QuoteItem) private quoteItemRepo: Repository<QuoteItem>,
    @InjectRepository(ServiceRequest) private srRepo: Repository<ServiceRequest>,
    @InjectRepository(Offer) private offerRepo: Repository<Offer>,
    private dataSource: DataSource,
    private notifications: NotificationsService,
  ) {}

  async createQuote(serviceRequestId: string, dto: CreateQuoteDto, actor?: User) {
    const result = await this.dataSource.transaction(async (em) => {
      const current = await em.findOne(ServiceRequest, {
        where: { id: serviceRequestId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!current) throw new NotFoundException('Service request not found');
      if (actor?.role === Role.TECHNICIAN && current.assignedTechnicianId !== actor.id) throw new ForbiddenException('This request is not assigned to you');
      const booking = current.bookingId
        ? await em.findOne(Booking, { where: { id: current.bookingId } })
        : null;
      if (!dto.items.length || [ServiceRequestStatus.DELIVERED, ServiceRequestStatus.OUT_FOR_DELIVERY].includes(current.status)) throw new BadRequestException('Cannot share this quotation');
      const previous = await em.find(QuoteItem, { where: { serviceRequestId } });
      if (previous.length) current.quoteArchive = [...(current.quoteArchive ?? []), {
        version: current.quoteVersion, items: previous, approved: current.quoteApproved,
        rejectedReason: current.quoteRejectedReason, archivedAt: new Date().toISOString(),
      }];
      current.quoteVersion += 1;
      current.quoteApproved = false;
      current.quoteRejectedReason = '';
      await em.save(current);
      // Clear existing quote items for this SR
      await em.delete(QuoteItem, { serviceRequestId });

      const items: QuoteItem[] = [];

      for (const item of dto.items) {
        const taxRate = item.taxRate ?? GST_RATE;
        const total = item.quantity * item.unitPrice;
        const qi = em.create(QuoteItem, {
          serviceRequestId,
          itemName: item.itemName?.trim() || undefined,
          description: item.description,
          hsnSac: item.hsnSac?.trim() || '998713',
          unit: item.unit?.trim() || 'PC',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total,
          taxRate,
        });
        items.push(await em.save(qi));
      }

      // Add diagnosis fee line item if requested
      if (dto.includeDiagnosisFee) {
        const diagBase = +(DIAGNOSIS_FEE / 1.18).toFixed(2);
        const qi = em.create(QuoteItem, {
          serviceRequestId,
          description: 'Diagnosis Fee',
          quantity: 1,
          unitPrice: diagBase,
          total: diagBase,
          taxRate: GST_RATE,
        });
        items.push(await em.save(qi));
      }

      if (booking?.referralDiscountPercent === 10 && current.bookingPosition === 0) {
        const basesByRate = items.reduce<Record<string, number>>((totals, item) => {
          const rate = String(Number(item.taxRate));
          totals[rate] = (totals[rate] ?? 0) + Number(item.total);
          return totals;
        }, {});
        for (const [rate, base] of Object.entries(basesByRate)) {
          const discount = +(-base * 0.1).toFixed(2);
          if (!discount) continue;
          items.push(await em.save(em.create(QuoteItem, {
            serviceRequestId, itemName: 'Referral discount', description: 'Referral discount (10%)',
            hsnSac: 'DISCOUNT', unit: 'BOOKING', quantity: 1, unitPrice: discount, total: discount, taxRate: Number(rate),
          })));
        }
      }

      if (booking?.offerId && current.bookingPosition === 0 && booking.referralDiscountPercent !== 10) {
        const offer = await em.findOne(Offer, { where: { id: booking.offerId } });
        const gross = items.reduce((sum, item) => sum + Number(item.total) * (1 + Number(item.taxRate) / 100), 0);
        if (offer && ['PERCENTAGE', 'FIXED_DISCOUNT'].includes(offer.offerType) && gross >= Number(offer.minimumBillingAmount)) {
          const requested = offer.offerType === 'PERCENTAGE' ? gross * Number(offer.discountValue) / 100 : Number(offer.discountValue);
          const grossDiscount = Math.min(requested, Number(offer.maximumDiscountCap), gross);
          if (grossDiscount > 0) {
            const baseDiscount = +(-grossDiscount / 1.18).toFixed(2);
            items.push(await em.save(em.create(QuoteItem, {
              serviceRequestId, itemName: 'App offer', description: offer.title,
              hsnSac: 'DISCOUNT', unit: 'BOOKING', quantity: 1, unitPrice: baseDiscount, total: baseDiscount, taxRate: GST_RATE,
            })));
          }
        }
      }

      const sr = await em.findOne(ServiceRequest, { where: { id: serviceRequestId } });
      if (!sr) throw new NotFoundException('Service request not found');

      const fromStatus = sr.status;
      await em.update(ServiceRequest, serviceRequestId, {
        status: ServiceRequestStatus.QUOTATION_SHARED,
      });

      const history = em.create(StatusHistory, {
        serviceRequestId,
        fromStatus,
        toStatus: ServiceRequestStatus.QUOTATION_SHARED,
        notes: 'Quote shared with customer',
        changedById: actor?.id,
      });
      await em.save(history);

      return items;
    });
    const sr = await this.srRepo.findOne({ where: { id: serviceRequestId }, relations: { customer: true } });
    if (sr) await this.notifications.triggerStatusNotification(ServiceRequestStatus.QUOTATION_SHARED, sr.customer, sr.id, sr.serviceRequestNumber, undefined, sr.serviceCategory).catch(() => {});
    return result;
  }

  async getQuote(serviceRequestId: string, user?: User) {
    const sr = await this.srRepo.findOne({ where: { id: serviceRequestId } });
    if (!sr) throw new NotFoundException();
    if (user?.role === Role.CUSTOMER && sr.customerId !== user.id) throw new ForbiddenException();
    if (user?.role === Role.TECHNICIAN && sr.assignedTechnicianId !== user.id) throw new ForbiddenException('This request is not assigned to you');
    if (user?.role === Role.DELIVERY_AGENT) throw new ForbiddenException();
    const items = await this.quoteItemRepo.find({ where: { serviceRequestId } });
    if (!items.length) throw new NotFoundException('No quote found for this service request');

    const taxableAmount = items.reduce((sum, i) => sum + +i.total, 0);
    const totalGst = items.reduce((sum, i) => sum + +i.total * (+i.taxRate / 100), 0);
    const cgst = +(totalGst / 2).toFixed(2);
    const sgst = +(totalGst / 2).toFixed(2);
    const grandTotal = +(taxableAmount + totalGst).toFixed(2);

    return { items, taxableAmount, cgst, sgst, grandTotal };
  }
}
