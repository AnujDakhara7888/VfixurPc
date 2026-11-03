import { DevicesService } from './devices.service';
import { Role } from '../common/enums';
describe('Device ownership', () => {
  const repo: any = { findOne: jest.fn(), find: jest.fn() };
  const service = new DevicesService(repo);
  beforeEach(() => { jest.clearAllMocks(); repo.findOne.mockResolvedValue({ id: 'device', customerId: 'alice' }); });
  it('filters the device list by the authenticated customer', async () => {
    await service.findByCustomer('bob'); expect(repo.find).toHaveBeenCalledWith({ where: { customerId: 'bob' } });
  });
  it('does not disclose another customer device by ID', async () => {
    await expect(service.findOwned('device', { id: 'bob', role: Role.CUSTOMER } as any)).rejects.toThrow('Device not found');
  });
  it('allows the owner to read their own device', async () => {
    await expect(service.findOwned('device', { id: 'alice', role: Role.CUSTOMER } as any)).resolves.toMatchObject({ id: 'device' });
  });
});
