import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, LessThan, MoreThan, Not, Repository } from 'typeorm';
import { NotificationType, Role, ServiceRequestStatus } from '../common/enums';
import { NotificationsService } from '../notifications/notifications.service';
import { ServiceRequest } from '../service-requests/entities/service-request.entity';
import { Booking } from '../service-requests/entities/booking.entity';
import { User } from '../users/user.entity';
import { Offer, OfferClaim } from './offer.entity';
import { SaveOfferDto } from './offer.dto';
import { WhatsAppService } from './whatsapp.service';

@Injectable()
export class OffersService {
  constructor(
    @InjectRepository(Offer) private offers: Repository<Offer>,
    @InjectRepository(OfferClaim) private claims: Repository<OfferClaim>,
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(ServiceRequest) private requests: Repository<ServiceRequest>,
    private db: DataSource,
    private notifications: NotificationsService,
    private whatsapp: WhatsAppService,
  ) {}

  adminList() { return this.offers.find({ order: { createdAt: 'DESC' } }); }

  async save(dto: SaveOfferDto, id?: string) {
    const startAt = new Date(dto.startAt), expiresAt = new Date(dto.expiresAt);
    if (expiresAt <= startAt) throw new BadRequestException('Expiry must be after the start date');
    if (![0, 150, 250].includes(dto.maximumDiscountCap)) throw new BadRequestException('Maximum benefit must be ₹150 or ₹250');
    if (['PERCENTAGE', 'FIXED_DISCOUNT'].includes(dto.offerType) && dto.maximumDiscountCap <= 0)
      throw new BadRequestException('Enter a discount cap of ₹150 or ₹250');
    const promoCode = dto.promoCode?.trim().toUpperCase() || null;
    if (dto.active && !promoCode) throw new BadRequestException('Enter a promo code before activating this offer');
    if (promoCode) {
      const duplicate = await this.offers.createQueryBuilder('offer')
        .where('UPPER(offer.promoCode) = :promoCode', { promoCode })
        .andWhere(id ? 'offer.id != :id' : '1=1', { id })
        .getOne();
      if (duplicate) throw new BadRequestException('This promo code is already used by another offer');
    }
    const current = id ? await this.offers.findOne({ where: { id } }) : undefined;
    if (id && !current) throw new NotFoundException('Offer not found');
    return this.offers.save(this.offers.create({ ...current, ...dto, promoCode, startAt, expiresAt } as Offer));
  }

  async eligibleFor(user: User) {
    const now = new Date();
    const offers = await this.offers.find({
      where: { active: true, promoCode: Not(IsNull()), startAt: LessThan(now), expiresAt: MoreThan(now) },
      order: { expiresAt: 'ASC' },
    });
    const result: Record<string, unknown>[] = [];
    for (const offer of offers) if (await this.isEligible(offer, user.id)) result.push(await this.publicOffer(offer, user.id));
    return result;
  }

  async getEligible(id: string, user: User) {
    const offer = await this.offers.findOne({ where: { id, active: true } });
    if (!offer?.promoCode || offer.startAt > new Date() || offer.expiresAt < new Date() || !await this.isEligible(offer, user.id)) throw new NotFoundException('Offer is unavailable');
    return this.publicOffer(offer, user.id);
  }

  private async publicOffer(offer: Offer, userId: string) {
    const used = await this.claims.count({ where: { offerId: offer.id, userId } });
    return { ...offer, remainingUses: Math.max(0, offer.usageLimitPerCustomer - used) };
  }

  async isEligible(offer: Offer, userId: string) {
    const used = await this.claims.count({ where: { offerId: offer.id, userId } });
    if (used >= offer.usageLimitPerCustomer) return false;
    if (offer.eligibleCustomerSegment === 'ALL_CUSTOMERS') return true;
    const completed = await this.requests.count({ where: { customerId: userId, status: ServiceRequestStatus.DELIVERED } });
    if (offer.eligibleCustomerSegment === 'RETURNING_CUSTOMERS') return completed > 0;
    if (!completed) return false;
    const last = await this.requests.findOne({ where: { customerId: userId }, order: { createdAt: 'DESC' } });
    return !!last && last.createdAt <= new Date(Date.now() - offer.inactiveDays * 86400000);
  }

  async validateForBooking(offerId: string, userId: string, categories: string[]) {
    const offer = await this.offers.findOne({ where: { id: offerId, active: true } });
    if (!offer?.promoCode || offer.startAt > new Date() || offer.expiresAt < new Date() || !await this.isEligible(offer, userId)) throw new BadRequestException('This offer is no longer available');
    if (offer.eligibleServiceCategories.length && !categories.some(category => offer.eligibleServiceCategories.includes(category))) throw new BadRequestException('This offer does not apply to the selected service');
    return offer;
  }

  async validateCode(codeInput: string, userId: string, categories: string[], manager?: EntityManager) {
    const code = codeInput.trim();
    if (!code) throw new BadRequestException('Enter a promo or referral code');
    const offerRepo = manager?.getRepository(Offer) ?? this.offers;
    const claimRepo = manager?.getRepository(OfferClaim) ?? this.claims;
    const requestRepo = manager?.getRepository(ServiceRequest) ?? this.requests;
    const userRepo = manager?.getRepository(User) ?? this.users;
    const bookingRepo = manager?.getRepository(Booking) ?? this.db.getRepository(Booking);
    const offer = await offerRepo.createQueryBuilder('offer')
      .where('UPPER(offer.promoCode) = :code', { code: code.toUpperCase() })
      .getOne();
    const now = new Date();
    if (offer) {
      if (!offer.active || offer.startAt > now || offer.expiresAt < now) throw new BadRequestException('This promo code is not currently active');
      const used = await claimRepo.count({ where: { offerId: offer.id, userId } });
      if (used >= offer.usageLimitPerCustomer) throw new BadRequestException('This promo code has already been used');
      if (offer.eligibleCustomerSegment !== 'ALL_CUSTOMERS') {
        const completed = await requestRepo.count({ where: { customerId: userId, status: ServiceRequestStatus.DELIVERED } });
        if (offer.eligibleCustomerSegment === 'RETURNING_CUSTOMERS' && !completed) throw new BadRequestException('This promo code is for returning customers');
        if (offer.eligibleCustomerSegment === 'INACTIVE_CUSTOMERS') {
          const last = await requestRepo.findOne({ where: { customerId: userId }, order: { createdAt: 'DESC' } });
          if (!completed || !last || last.createdAt > new Date(Date.now() - offer.inactiveDays * 86400000)) throw new BadRequestException('This promo code is not available for this account');
        }
      }
      if (offer.eligibleServiceCategories.length && !categories.some(category => offer.eligibleServiceCategories.includes(category))) {
        throw new BadRequestException('This promo code does not apply to the selected service');
      }
      return {
        kind: 'OFFER' as const, code: offer.promoCode!, offerId: offer.id, title: offer.title,
        description: offer.shortDescription, maximumDiscountCap: offer.maximumDiscountCap,
        minimumBillingAmount: offer.minimumBillingAmount,
      };
    }

    const customer = await userRepo.findOne({ where: { id: userId } });
    const referrer = await userRepo.findOne({ where: { username: code.toLowerCase(), role: Role.CUSTOMER, isActive: true } });
    if (!referrer) throw new BadRequestException('Promo or referral code was not found');
    if (!customer || referrer.id === customer.id) throw new BadRequestException('You cannot use your own referral code');
    if (customer.referralDiscountUsedAt) throw new BadRequestException('Your referral discount has already been used');
    if (customer.referredByUserId && customer.referredByUserId !== referrer.id) throw new BadRequestException('A different referral is already linked to this account');
    if (await bookingRepo.count({ where: { customerId: userId } })) throw new BadRequestException('Referral codes are available only on your first booking');
    return {
      kind: 'REFERRAL' as const, code: referrer.username, referrerId: referrer.id,
      title: 'Referral discount', description: '10% off the first device in your first booking', percent: 10,
    };
  }

  claim(em: any, offerId: string, userId: string, bookingId: string) {
    return em.save(em.create(OfferClaim, { offerId, userId, bookingId }));
  }

  async sendCampaign(id: string, channels: ('PUSH' | 'WHATSAPP')[] = ['PUSH']) {
    const offer = await this.offers.findOne({ where: { id } });
    if (!offer?.promoCode || !offer.active || offer.startAt > new Date() || offer.expiresAt < new Date()) throw new BadRequestException('Activate a currently valid offer with a promo code before sending');
    if (!channels.length) throw new BadRequestException('Choose push, WhatsApp, or both');
    if (channels.includes('WHATSAPP') && (!offer.whatsappTemplateName || !this.whatsapp.isConfigured()))
      throw new BadRequestException('Configure an approved MSG91 WhatsApp template, sender and namespace before sending.');
    const customers = await this.users.find({ where: { role: Role.CUSTOMER, isActive: true } });
    let pushSent = 0, whatsappSent = 0, skippedFrequency = 0, skippedEligibility = 0, skippedConsent = 0;
    for (const user of customers) {
      if (!await this.isEligible(offer, user.id)) { skippedEligibility++; continue; }
      const [{ count }] = await this.db.query(`SELECT COUNT(*)::int count FROM notifications WHERE user_id=$1 AND offer_id IS NOT NULL AND sent_at > NOW() - INTERVAL '7 days'`, [user.id]);
      if (Number(count) >= 2) { skippedFrequency++; continue; }
      let delivered = false, pushDelivered = false;
      if (channels.includes('PUSH') && user.promotionalPushOptIn) {
        await this.notifications.notify(user, offer.pushBody, undefined, { title: offer.pushTitle, offerId: offer.id, deepLink: `vfixurpc://offers/${offer.id}` });
        pushSent++; delivered = true; pushDelivered = true;
      }
      if (channels.includes('WHATSAPP') && user.promotionalWhatsappOptIn) {
        const values = (offer.whatsappParameters ?? []).map(value => value
          .replace(/{{name}}/g, user.name)
          .replace(/{{code}}/g, offer.promoCode ?? '')
          .replace(/{{title}}/g, offer.title));
        await this.whatsapp.sendTemplate(user.phone, offer.whatsappTemplateName!, offer.whatsappLanguage || 'en', values);
        if (!pushDelivered) await this.notifications.recordExternal(user, offer.pushBody, NotificationType.SMS, { title: offer.pushTitle, offerId: offer.id, deepLink: `vfixurpc://offers/${offer.id}` });
        whatsappSent++; delivered = true;
      }
      if (!delivered) skippedConsent++;
    }
    return { pushSent, whatsappSent, skippedFrequency, skippedEligibility, skippedConsent, considered: customers.length };
  }
}
