import { ServiceRequestsService } from './service-requests.service';
import { Booking } from './entities/booking.entity';
import { ServiceRequest } from './entities/service-request.entity';
import { Device } from '../devices/device.entity';
import { Role } from '../common/enums';
import { User } from '../users/user.entity';
import { randomUUID } from 'crypto';
import { CreateBookingDto } from './dto/create-booking.dto';

describe('Grouped booking invariants', () => {
  let service: ServiceRequestsService, em: any, rows: any[], notifications: any, catalog: any, active: boolean, referredBy: string | null, referralUsedAt: Date | null;
  const customer = { id: 'owner', role: Role.CUSTOMER } as any;
  const request = (mode = 'PICKUP'): any => ({
    serviceCategory: 'upgrade', serviceMode: mode,
    newDevice: { brand: 'Dell', model: 'Latitude' },
    bookingAnswers: { requestedUpgrades: ['RAM', 'SSD', 'Storage', 'General Performance', 'Not sure'] },
    issues: ['RAM', 'SSD', 'Storage', 'General Performance', 'Not sure'].map(category => ({ category })),
    pickupSlotDate: '2099-01-15', pickupSlotTime: '13:00 - 14:00', pickupAddress: 'Vile Parle West, Mumbai customer address',
    termsAccepted: true, policyVersion: '2026-08-31',
  });
  const dto = (mode = 'PICKUP'): CreateBookingDto => ({ id: randomUUID(), feePolicyVersion: '2026-10-02', feesAccepted: true, requests: [request(mode), request(mode)] });
  beforeEach(() => {
    rows = []; active = true; referredBy = null; referralUsedAt = null;
    const matches = (r: any, where: any) => Object.entries(where).every(([key, value]) => r[key] === value);
    em = {
      query: jest.fn(async () => [{ is_active: active, referred_by_user_id: referredBy, referral_discount_used_at: referralUsedAt }]),
      update: jest.fn(async (entity: any, id: string, values: any) => {
        if (entity === User && id === customer.id && values.referredByUserId) referredBy = values.referredByUserId;
        if (entity === User && id === customer.id && values.referralDiscountUsedAt) referralUsedAt = values.referralDiscountUsedAt;
      }),
      create: (entity: any, values: any) => Object.assign(new entity(), values),
      save: jest.fn(async (values: any) => {
        for (const value of Array.isArray(values) ? values : [values]) {
          value.id ??= randomUUID();
          if (!rows.includes(value)) rows.push(value);
        }
        return values;
      }),
      findOne: jest.fn(async (entity: any, options: any) => rows.find(r => r instanceof entity && matches(r, options.where))),
      find: jest.fn(async (entity: any, options: any) => rows.filter(r => r instanceof entity && matches(r, options.where)).sort((a,b) => a.bookingPosition - b.bookingPosition)),
      getRepository: (entity: any) => entity === Device ? {
        exists: async ({ where }: any) => rows.some(r => r instanceof Device && matches(r, where)),
      } : { find: async () => [{ startTime: '13:00', endTime: '14:00', isActive: true }] },
    };
    notifications = { notifyAdmins: jest.fn(async () => {}), triggerStatusNotification: jest.fn(async () => {}) };
    catalog = { get: jest.fn(async () => ({ modes: ['PICKUP', 'CARRY_IN', 'ON_SITE', 'CONSULTATION'], needsDevice: true, fields: [] })) };
    const db = { transaction: async (fn: any) => {
      const before = [...rows];
      try { return await fn(em); } catch (error) { rows = before; throw error; }
    } };
    const offers = {
      validateCode: jest.fn(async (code: string) => {
        if (referralUsedAt) throw new Error('already been used');
        return { kind: 'REFERRAL', code, referrerId: 'referrer', percent: 10 };
      }),
      validateForBooking: jest.fn(), claim: jest.fn(),
    };
    service = new ServiceRequestsService({} as any, {} as any, {} as any, db as any, notifications, catalog, { planBooking: jest.fn(async () => []) } as any, offers as any);
  });
  it('preserves all upgrades on each child and charges transport only once', async () => {
    const input = dto();
    const result = await service.createBooking(input, customer);
    expect(result.booking.transportBase + result.booking.transportTax).toBe(413);
    expect(rows.filter(r => r instanceof Booking)).toHaveLength(1);
    expect(result.requests).toHaveLength(2);
    expect(new Set(result.requests.map(r => r.deviceId)).size).toBe(2);
    expect(result.requests.map(r => r.bookingPosition)).toEqual([0, 1]);
    expect(result.requests[0].bookingAnswers.requestedUpgrades).toEqual(input.requests[0].bookingAnswers!.requestedUpgrades);
  });
  it('replays the same booking in attachment order without extra devices, fees or notifications', async () => {
    const input = dto();
    const initial = await service.createBooking(input, customer);
    const retry = await service.createBooking(input, customer);
    expect(retry.requests.map(r => r.id)).toEqual(initial.requests.map(r => r.id));
    expect(rows.filter(r => r instanceof Device)).toHaveLength(2);
    expect(notifications.notifyAdmins).toHaveBeenCalledTimes(1);
  });
  it('canonicalises carry-in location and creates no transport charge', async () => {
    const result = await service.createBooking(dto('CARRY_IN'), customer);
    expect(result.booking.transportBase + result.booking.transportTax).toBe(0);
    expect(result.requests.every(r => r.status === 'REQUEST_RECEIVED')).toBe(true);
    expect(result.requests[0].pickupAddress).not.toContain('customer address');
  });
  it('does not put on-site appointments in pickup scheduled state', async () => {
    const result = await service.createBooking(dto('ON_SITE'), customer);
    expect(result.requests[0].status).toBe('REQUEST_RECEIVED');
    expect(result.requests[0].pickupAddress).toBe('Vile Parle West, Mumbai customer address');
  });
  it('rolls back the entire booking when the second device fails validation', async () => {
    const input = dto(); input.requests[1].termsAccepted = false;
    await expect(service.createBooking(input, customer)).rejects.toThrow('Terms');
    expect(rows).toHaveLength(0);
    expect(notifications.notifyAdmins).not.toHaveBeenCalled();
  });
  it('rejects a foreign device and creates no partial booking', async () => {
    const input = dto(); delete input.requests[1].newDevice; input.requests[1].deviceId = randomUUID();
    await expect(service.createBooking(input, customer)).rejects.toThrow('does not belong');
    expect(rows).toHaveLength(0);
  });
  it.each(['serviceMode', 'pickupSlotTime', 'pickupSlotDate', 'pickupAddress'])('rejects mismatched %s', async key => {
    const input = dto();
    (input.requests[1] as any)[key] = key === 'serviceMode' ? 'CARRY_IN' : key === 'pickupAddress' ? 'Juhu, Mumbai' : 'different';
    await expect(service.createBooking(input, customer)).rejects.toThrow('must share');
  });
  it('requires explicit current fee consent', async () => {
    const input = dto(); input.feesAccepted = false;
    await expect(service.createBooking(input, customer)).rejects.toThrow('fees');
    expect(rows).toHaveLength(0);
  });
  it('applies an explicitly entered referral code to the first booking only', async () => {
    const firstInput = dto(); firstInput.discountCode = 'friend';
    const first = await service.createBooking(firstInput, customer);
    const secondInput = dto(); secondInput.discountCode = 'friend';
    await expect(service.createBooking(secondInput, customer)).rejects.toThrow('already been used');
    expect(first.booking.referralDiscountPercent).toBe(10);
    expect(referredBy).toBe('referrer');
    expect(referralUsedAt).toBeInstanceOf(Date);
  });
  it('blocks booking after account deletion', async () => {
    active = false;
    await expect(service.createBooking(dto(), customer)).rejects.toThrow('no longer active');
    expect(rows).toHaveLength(0);
  });
  it('rejects another customer using an existing booking id', async () => {
    const input = dto(); await service.createBooking(input, customer);
    await expect(service.createBooking(input, { ...customer, id: 'other' })).rejects.toThrow();
  });
});
