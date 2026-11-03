import { AuthService } from './auth.service';

describe('Email registration verification', () => {
  it('stores a short-lived pending challenge and does not create the user before OTP verification', async () => {
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const manager = {
      query: jest.fn(async (sql: string, params: unknown[] = []) => {
        queries.push({ sql, params });
        return [];
      }),
      transaction: jest.fn(async (callback: (value: any) => unknown) => callback(manager)),
    };
    const repository = {
      exists: jest.fn(async () => false),
      findOne: jest.fn(async () => null),
      create: jest.fn(),
      save: jest.fn(),
      manager,
    };
    const emailOtp = { isConfigured: jest.fn(() => true), send: jest.fn(async () => {}) };
    const service = new AuthService(
      repository as any,
      {} as any,
      { getOrThrow: jest.fn(() => 'secret') } as any,
      {} as any,
      {} as any,
      emailOtp as any,
    );

    const result = await service.register({
      name: 'New Customer',
      email: 'NEW@example.com',
      phone: '+919876543210',
      username: 'NewCustomer',
      password: 'Password123',
    });

    expect(result).toEqual(expect.objectContaining({ requiresOtp: true, channel: 'email', maskedEmail: 'ne***@example.com', expiresInSeconds: 600 }));
    expect(emailOtp.send).toHaveBeenCalledWith('new@example.com', expect.stringMatching(/^\d{6}$/), 'registration');
    expect(repository.save).not.toHaveBeenCalled();
    expect(queries.some(({ sql }) => sql.includes('INSERT INTO registration_otp_challenges'))).toBe(true);
    const insert = queries.find(({ sql }) => sql.includes('INSERT INTO registration_otp_challenges'))!;
    expect(insert.params).toEqual(expect.arrayContaining(['New Customer', 'new@example.com', '+919876543210', 'newcustomer']));
    expect(insert.params).not.toContain('Password123');
  });
});
