import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Role, PaymentStatus } from '../common/enums';
import { PaymentsService } from './payments.service';

describe('Payments security', () => {
  const request = { id: 'request', customerId: 'customer', quoteApproved: true };
  const paymentRepo: any = {
    find: jest.fn(async () => []),
    findOne: jest.fn(async () => null),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({ ...value, id: 'payment' })),
    update: jest.fn(async () => ({ affected: 1 })),
  };
  const requestRepo: any = { findOne: jest.fn(async () => request) };
  const quoteRepo: any = {
    find: jest.fn(async () => [{ total: 1000, taxRate: 18 }]),
  };
  const config: any = {
    get: jest.fn((key: string) => key.includes('KEY') ? 'test-key' : undefined),
    getOrThrow: jest.fn(() => 'webhook-secret'),
  };
  let service: PaymentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    requestRepo.findOne.mockResolvedValue(request);
    quoteRepo.find.mockResolvedValue([{ total: 1000, taxRate: 18 }]);
    paymentRepo.find.mockResolvedValue([]);
    service = new PaymentsService(paymentRepo, requestRepo, quoteRepo, config);
    (service as any).razorpay = {
      orders: { create: jest.fn(async () => ({ id: 'order' })) },
      payments: { refund: jest.fn(async () => ({})) },
    };
  });

  it('does not let a customer pay another customer request', async () => {
    await expect(service.createOrder(
      { serviceRequestId: 'request', amount: 1180 },
      { id: 'attacker', role: Role.CUSTOMER } as any,
    )).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a client-controlled amount that differs from the server quote', async () => {
    await expect(service.createOrder(
      { serviceRequestId: 'request', amount: 1 },
      { id: 'customer', role: Role.CUSTOMER } as any,
    )).rejects.toBeInstanceOf(BadRequestException);
    expect((service as any).razorpay.orders.create).not.toHaveBeenCalled();
  });

  it('creates the gateway order from the approved server-side total', async () => {
    const result = await service.createOrder(
      { serviceRequestId: 'request', amount: 1180 },
      { id: 'customer', role: Role.CUSTOMER } as any,
    );
    expect((service as any).razorpay.orders.create).toHaveBeenCalledWith(expect.objectContaining({ amount: 118000, currency: 'INR' }));
    expect(paymentRepo.save).toHaveBeenCalledWith(expect.objectContaining({ amount: 1180, status: PaymentStatus.PENDING }));
    expect(result).toEqual(expect.objectContaining({ orderId: 'order', amount: 118000, paymentId: 'payment' }));
  });
});
