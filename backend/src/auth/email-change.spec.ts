import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

describe('Verified email changes', () => {
  function serviceFor(options: { emailExists?: boolean } = {}) {
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const manager = {
      query: jest.fn(async (sql: string, params: unknown[] = []) => {
        queries.push({ sql, params });
        if (sql.includes('SELECT id FROM email_change_challenges')) return [];
        return [];
      }),
      transaction: jest.fn(async (callback: (value: any) => unknown) => callback(manager)),
    };
    const repository = {
      createQueryBuilder: jest.fn(() => ({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn(async () => ({
          id: 'b12b6437-930f-418c-85a0-122c38f05592',
          email: 'old@example.com',
          passwordHash: bcrypt.hashSync('Password123', 4),
          isActive: true,
        })),
      })),
      exists: jest.fn(async () => !!options.emailExists),
      manager,
    };
    const emailOtp = { isConfigured: jest.fn(() => true), send: jest.fn(async () => {}) };
    const service = new AuthService(
      repository as any,
      {} as any,
      { getOrThrow: jest.fn(() => 'test-secret') } as any,
      {} as any,
      {} as any,
      emailOtp as any,
    );
    return { service, queries, emailOtp };
  }

  it('verifies the password and sends a code to the normalized new address', async () => {
    const { service, queries, emailOtp } = serviceFor();
    const result = await service.requestEmailChange(
      'b12b6437-930f-418c-85a0-122c38f05592',
      ' New.Address@Example.com ',
      'Password123',
    );

    expect(result).toEqual(expect.objectContaining({ maskedEmail: 'ne********@example.com', expiresInSeconds: 600 }));
    expect(emailOtp.send).toHaveBeenCalledWith('new.address@example.com', expect.stringMatching(/^\d{6}$/), 'email-change');
    expect(queries.some(({ sql }) => sql.includes('INSERT INTO email_change_challenges'))).toBe(true);
  });

  it('does not send a code when the new email already belongs to another account', async () => {
    const { service, emailOtp } = serviceFor({ emailExists: true });
    await expect(service.requestEmailChange(
      'b12b6437-930f-418c-85a0-122c38f05592',
      'used@example.com',
      'Password123',
    )).rejects.toThrow('Email already in use');
    expect(emailOtp.send).not.toHaveBeenCalled();
  });
});
