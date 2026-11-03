import { OffersService } from './offers.service';
import { Role, ServiceRequestStatus } from '../common/enums';

describe('OffersService discount codes', () => {
  const offer = {
    id: 'offer-id', promoCode: 'SAVE150', active: true,
    startAt: new Date('2026-01-01'), expiresAt: new Date('2099-01-01'),
    usageLimitPerCustomer: 1, eligibleCustomerSegment: 'ALL_CUSTOMERS',
    eligibleServiceCategories: ['laptop'], title: 'Save now', shortDescription: 'Save on laptop repair',
    maximumDiscountCap: 150, minimumBillingAmount: 500,
  } as any;

  function setup(foundOffer: any = offer) {
    const offerRepo: any = {
      createQueryBuilder: () => ({ where: () => ({ getOne: async () => foundOffer }) }),
    };
    const claims: any = { count: jest.fn(async () => 0) };
    const users: any = { findOne: jest.fn() };
    const requests: any = { count: jest.fn(async () => 0), findOne: jest.fn() };
    const bookings: any = { count: jest.fn(async () => 0) };
    const db: any = { getRepository: (entity: any) => entity.name === 'Booking' ? bookings : undefined };
    return { service: new OffersService(offerRepo, claims, users, requests, db, {} as any, {} as any), users, bookings };
  }

  it('validates an active admin promo code for an eligible service', async () => {
    const { service } = setup();
    await expect(service.validateCode(' save150 ', 'customer', ['laptop'])).resolves.toMatchObject({ kind: 'OFFER', offerId: 'offer-id', code: 'SAVE150' });
  });

  it('accepts another customer username only before the first booking', async () => {
    const { service, users } = setup(null);
    users.findOne
      .mockResolvedValueOnce({ id: 'customer', role: Role.CUSTOMER, referredByUserId: null, referralDiscountUsedAt: null })
      .mockResolvedValueOnce({ id: 'friend', username: 'friend', role: Role.CUSTOMER, isActive: true });
    await expect(service.validateCode('FRIEND', 'customer', ['laptop'])).resolves.toMatchObject({ kind: 'REFERRAL', percent: 10, referrerId: 'friend' });
  });

  it('rejects a referral after any booking exists', async () => {
    const { service, users, bookings } = setup(null);
    users.findOne
      .mockResolvedValueOnce({ id: 'customer', role: Role.CUSTOMER, referredByUserId: null, referralDiscountUsedAt: null })
      .mockResolvedValueOnce({ id: 'friend', username: 'friend', role: Role.CUSTOMER, isActive: true });
    bookings.count.mockResolvedValue(1);
    await expect(service.validateCode('friend', 'customer', ['laptop'])).rejects.toThrow('first booking');
  });
});
