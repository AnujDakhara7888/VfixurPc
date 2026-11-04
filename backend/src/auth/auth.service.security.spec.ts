import { ServiceUnavailableException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { createHmac } from 'crypto';
import { AuthService } from './auth.service';
import { Role } from '../common/enums';

describe('AuthService security behavior', () => {
  it('fails closed when customer OTP is enabled but email is not configured', async () => {
    const user = {
      id: '2e9a5824-d3e8-4702-b3bd-c8361bd91dd0',
      username: 'customer',
      passwordHash: await bcrypt.hash('correct horse battery staple', 4),
      role: Role.CUSTOMER,
      isActive: true,
    };
    const queryBuilder = {
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(user),
    };
    const repository = { createQueryBuilder: jest.fn(() => queryBuilder) };
    const config = {
      get: jest.fn((key: string, fallback?: string) => key === 'CUSTOMER_LOGIN_OTP_ENABLED' ? 'true' : fallback),
    };
    const emailOtp = { isConfigured: jest.fn(() => false) };
    const service = new AuthService(
      repository as any,
      {} as any,
      config as any,
      {} as any,
      {} as any,
      emailOtp as any,
    );

    await expect(service.login({ username: 'customer', password: 'correct horse battery staple' }))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  const createChallengeService = (reviewUsername = 'playreview', reviewOtp = '654321') => {
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const manager = {
      query: jest.fn(async (sql: string, params: unknown[]) => {
        queries.push({ sql, params });
        return [];
      }),
      transaction: jest.fn(async (callback: (transactionManager: any) => unknown) => callback(manager)),
    };
    const repository = { manager };
    const config = {
      get: jest.fn((key: string, fallback?: string) => {
        if (key === 'PLAY_REVIEW_USERNAME') return reviewUsername;
        if (key === 'PLAY_REVIEW_OTP') return reviewOtp;
        return fallback;
      }),
      getOrThrow: jest.fn(() => 'test-jwt-secret'),
    };
    const emailOtp = { send: jest.fn() };
    const service = new AuthService(
      repository as any,
      {} as any,
      config as any,
      {} as any,
      {} as any,
      emailOtp as any,
    );
    return { service, queries, emailOtp };
  };

  it('uses the configured reusable OTP only for the Play review customer', async () => {
    const { service, queries, emailOtp } = createChallengeService();
    const user = {
      id: 'a30c0192-cbe5-4db0-8d8d-889f681f9067',
      username: 'playreview',
      email: 'reviewer@example.com',
      role: Role.CUSTOMER,
    };

    const result = await (service as any).createLoginChallenge(user);
    const insert = queries.find(item => item.sql.includes('INSERT INTO login_otp_challenges'));
    const expectedDigest = createHmac('sha256', 'test-jwt-secret')
      .update(`${user.id}:${result.challengeId}:654321`).digest('hex');

    expect(insert?.params).toEqual([result.challengeId, user.id, expectedDigest]);
    expect(emailOtp.send).not.toHaveBeenCalled();
  });

  it('continues sending a random email OTP to ordinary customers', async () => {
    const { service, emailOtp } = createChallengeService();
    const user = {
      id: '2e9a5824-d3e8-4702-b3bd-c8361bd91dd0',
      username: 'customer',
      email: 'customer@example.com',
      role: Role.CUSTOMER,
    };

    await (service as any).createLoginChallenge(user);

    expect(emailOtp.send).toHaveBeenCalledWith(user.email, expect.stringMatching(/^\d{6}$/), 'login');
  });

  it('fails closed to normal email OTP behavior when the review code is malformed', async () => {
    const { service, emailOtp } = createChallengeService('playreview', 'not-a-code');
    const user = {
      id: 'a30c0192-cbe5-4db0-8d8d-889f681f9067',
      username: 'playreview',
      email: 'reviewer@example.com',
      role: Role.CUSTOMER,
    };

    await (service as any).createLoginChallenge(user);

    expect(emailOtp.send).toHaveBeenCalledWith(user.email, expect.stringMatching(/^\d{6}$/), 'login');
  });
});
