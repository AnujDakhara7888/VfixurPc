import { AuthService } from './auth.service';
import { Role } from '../common/enums';

describe('Referral registration', () => {
  const base = { name: 'New Customer', email: 'new@example.com', phone: '+919999999999', username: 'newcustomer', password: 'Password123' };
  function setup(referrer?: any) {
    const users: any = {
      exists: jest.fn(async () => false),
      findOne: jest.fn(async ({ where }: any) => where.username === referrer?.username ? referrer : null),
      create: jest.fn((value: any) => ({ id: 'new-id', ...value })),
      save: jest.fn(async (value: any) => value),
      update: jest.fn(async () => ({})),
    };
    const service = new AuthService(
      users,
      { sign: jest.fn(() => 'token') } as any,
      { get: jest.fn((_key: string, fallback?: string) => fallback ?? 'secret') } as any,
      { notifyAdmins: jest.fn(async () => {}) } as any,
      { removeForUser: jest.fn() } as any,
      { isConfigured: jest.fn(() => true), send: jest.fn(async () => {}) } as any,
    );
    (service as any).generateTokens = jest.fn(async (user: any) => ({ user }));
    return { service, users };
  }

  it('stores a valid active customer referrer', async () => {
    const referrer = { id: 'friend-id', username: 'friend', role: Role.CUSTOMER, isActive: true };
    const { service, users } = setup(referrer);
    await service.register({ ...base, referralUsername: ' FRIEND ' }, Role.SUPER_ADMIN);
    expect(users.create).toHaveBeenCalledWith(expect.objectContaining({ referredByUserId: 'friend-id' }));
  });

  it('rejects self-referral and unknown usernames', async () => {
    await expect(setup().service.register({ ...base, referralUsername: base.username })).rejects.toThrow('another customer');
    await expect(setup().service.register({ ...base, referralUsername: 'missing' })).rejects.toThrow('not found');
  });
});
