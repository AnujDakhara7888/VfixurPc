import { ServiceRequestsService } from './service-requests.service';
import { Role, ServiceRequestStatus } from '../common/enums';
describe('Customer collection', () => {
  let service: ServiceRequestsService, sr: any, em: any, notifications: any;
  const admin: any = { id: 'admin', role: Role.OPERATIONS };
  beforeEach(() => {
    sr = { id: 'ticket', status: ServiceRequestStatus.READY_FOR_HANDOVER, customer: { id: 'customer' }, serviceRequestNumber: 'VFX-TEST' };
    em = { findOne: jest.fn(async () => sr), save: jest.fn(async x => x), create: jest.fn((entity, data) => data) };
    notifications = { notify: jest.fn(async () => {}) };
    service = new ServiceRequestsService({ findOne: jest.fn(async () => sr) } as any, {} as any, {} as any, { transaction: async (fn: any) => fn(em) } as any, notifications, {} as any, {} as any);
  });
  it('records recipient, actor and collection method and notifies customer', async () => {
    await service.collectByCustomer('ticket', ' Hriday ', admin);
    expect(sr.status).toBe(ServiceRequestStatus.DELIVERED);
    expect(sr.handoverMethod).toBe('CUSTOMER_COLLECTION');
    expect(em.save).toHaveBeenCalledWith(expect.objectContaining({ changedById: 'admin', notes: 'Collected by customer. Received by: Hriday' }));
    expect(notifications.notify).toHaveBeenCalledTimes(1);
  });
  it.each([Role.CUSTOMER, Role.TECHNICIAN, Role.DELIVERY_AGENT])('rejects %s', async role => {
    await expect(service.collectByCustomer('ticket', 'Hriday', { ...admin, role })).rejects.toThrow();
    expect(em.save).not.toHaveBeenCalled();
  });
  it('rejects missing recipient, early handover and duplicate collection', async () => {
    await expect(service.collectByCustomer('ticket', '  ', admin)).rejects.toThrow('name');
    sr.status = ServiceRequestStatus.UNDER_REPAIR;
    await expect(service.collectByCustomer('ticket', 'Hriday', admin)).rejects.toThrow('ready');
    sr.status = ServiceRequestStatus.DELIVERED;
    await expect(service.collectByCustomer('ticket', 'Hriday', admin)).rejects.toThrow('ready');
    expect(em.save).not.toHaveBeenCalled();
  });
});
