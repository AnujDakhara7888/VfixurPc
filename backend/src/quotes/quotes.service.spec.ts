import { Booking } from '../service-requests/entities/booking.entity';
import { ServiceRequest } from '../service-requests/entities/service-request.entity';
import { QuotesService } from './quotes.service';

describe('QuotesService', () => {
  it('locks only the service request row before loading its optional booking', async () => {
    const request = {
      id: 'request-id',
      bookingId: 'booking-id',
      bookingPosition: 0,
      quoteArchive: [],
      quoteVersion: 0,
      status: 'DIAGNOSED',
    } as any;
    const booking = { id: 'booking-id', referralDiscountPercent: 0, offerId: null } as any;
    const em = {
      findOne: jest.fn(async (entity: unknown) => {
        if (entity === Booking) return booking;
        return request;
      }),
      find: jest.fn(async () => []),
      save: jest.fn(async (value: unknown) => value),
      create: jest.fn((_entity: unknown, value: unknown) => value),
      delete: jest.fn(async () => undefined),
      update: jest.fn(async () => undefined),
    };
    const service = new QuotesService(
      {} as any,
      { findOne: jest.fn(async () => null) } as any,
      {} as any,
      { transaction: (work: (manager: typeof em) => unknown) => work(em) } as any,
      { triggerStatusNotification: jest.fn() } as any,
    );

    await service.createQuote('request-id', {
      items: [{ description: 'Repair', quantity: 1, unitPrice: 100 }],
    } as any);

    expect(em.findOne).toHaveBeenNthCalledWith(1, ServiceRequest, {
      where: { id: 'request-id' },
      lock: { mode: 'pessimistic_write' },
    });
    expect(em.findOne).toHaveBeenNthCalledWith(2, Booking, {
      where: { id: 'booking-id' },
    });
  });
});
