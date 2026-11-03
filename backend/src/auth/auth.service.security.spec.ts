import { ServiceUnavailableException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
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
});
