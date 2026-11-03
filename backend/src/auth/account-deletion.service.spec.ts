import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { validate } from 'class-validator';
import { AccountDeletionService } from './account-deletion.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { Role } from '../common/enums';

jest.mock('bcrypt', () => ({ compare: jest.fn(), hash: jest.fn() }));

describe('Account deletion', () => {
  const id = '7cf02153-a435-434a-b052-c28920449196';
  let query: jest.Mock;
  let transaction: jest.Mock;
  let service: AccountDeletionService;
  beforeEach(() => {
    jest.resetAllMocks();
    query = jest.fn().mockResolvedValue([]);
    query.mockResolvedValueOnce([{ id, role: Role.CUSTOMER, password_hash: 'old-hash', is_active: true }]);
    transaction = jest.fn(work => work({ query }));
    service = new AccountDeletionService({ transaction } as any);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (bcrypt.hash as jest.Mock).mockResolvedValue('replacement-hash');
  });

  it('returns 400 for a wrong password without writes or token refresh semantics', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    const error = await service.delete(id, 'wrong').catch(e => e);
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.getStatus()).toBe(400);
    expect(error.message).toBe('Incorrect password');
    expect(bcrypt.compare).toHaveBeenCalledWith('wrong', 'old-hash');
    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledTimes(1);
  });

  it.each([{ rows: [] }, { rows: [{ id, is_active: false }] }])('rejects missing/inactive accounts before any writes: %j', async ({ rows }) => {
    query.mockReset().mockResolvedValueOnce(rows);
    await expect(service.delete(id, 'secret')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(query).toHaveBeenCalledTimes(1);
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  it.each([Role.SUPER_ADMIN, Role.TECHNICIAN, Role.OPERATIONS, Role.DELIVERY_AGENT])('rejects staff %s even with a valid password', async role => {
    query.mockReset().mockResolvedValueOnce([{ id, role, is_active: true }]);
    await expect(service.delete(id, 'secret')).rejects.toBeInstanceOf(ForbiddenException);
    expect(query).toHaveBeenCalledTimes(1);
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  it('locks the customer and revokes credentials in the same transaction as anonymisation', async () => {
    await service.delete(id, 'secret');
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]).toEqual([expect.stringContaining('FOR UPDATE'), [id]]);
    const [sql, params] = query.mock.calls[1];
    for (const field of ["name = 'Deleted customer'", 'is_active = false', 'refresh_token = NULL', 'fcm_token = NULL', 'token_version = token_version + 1']) expect(sql).toContain(field);
    expect(params).toEqual([id, `deleted-${id}@invalid.example`, `deleted-${id}`, 'replacement-hash']);
    expect(bcrypt.hash).toHaveBeenCalledWith(expect.any(String), 12);
    expect((bcrypt.hash as jest.Mock).mock.calls[0][0]).not.toBe('secret');
  });

  it('scopes all data changes to this customer and clears nonfinancial profile data', async () => {
    await service.delete(id, 'secret');
    const statements = query.mock.calls.slice(2);
    for (const [sql, params] of statements) {
      expect(params).toEqual([id]);
      expect(sql).toMatch(/(?:user_id|customer_id) = \$1/);
    }
    const sql = statements.map(call => call[0]).join('\n');
    for (const table of ['password_resets', 'web_push_subscriptions', 'notifications', 'ticket_attachments']) expect(sql).toContain(`DELETE FROM ${table}`);
    for (const field of ['serial_number = NULL', 'specs = NULL', 'description = NULL', 'notes = NULL', "booking_answers = '{}'", 'quote_rejected_reason = NULL']) expect(sql).toContain(field);
  });

  it('preserves quote archives, invoice/tax/payment and warranty records and discloses residual data', async () => {
    const result = await service.delete(id, 'secret');
    const sql = query.mock.calls.map(call => call[0]).join('\n');
    expect(sql).not.toMatch(/\b(quote_archive|quote_items|invoices|payments|repair_warranties|warranty_claims)\b/);
    expect(sql).not.toMatch(/DELETE FROM (users|service_requests|devices|condition_photos)/);
    expect(result.message).toContain('not erased');
    expect(result.message).toContain('Invoice, tax, quote and warranty');
  });

  it('propagates a cleanup failure to the transaction instead of reporting success', async () => {
    query.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('cleanup failed'));
    await expect(service.delete(id, 'secret')).rejects.toThrow('cleanup failed');
    expect(query).toHaveBeenCalledTimes(3);
  });

  it('does not mutate the account if password hashing fails', async () => {
    (bcrypt.hash as jest.Mock).mockRejectedValue(new Error('hash failed'));
    await expect(service.delete(id, 'secret')).rejects.toThrow('hash failed');
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('requires the exact confirmation and a nonempty password at the controller boundary', async () => {
    const [, Dto] = Reflect.getMetadata('design:paramtypes', AuthController.prototype, 'deleteAccount');
    for (const body of [{ password: 'secret' }, { password: 'secret', confirmation: 'delete' }, { password: '', confirmation: 'DELETE' }]) {
      expect((await validate(Object.assign(new Dto(), body))).length).toBeGreaterThan(0);
    }
    expect(await validate(Object.assign(new Dto(), { password: 'secret', confirmation: 'DELETE' }))).toHaveLength(0);
  });

  it('rejects revoked access tokens through the existing JWT strategy', async () => {
    const repo = { findOne: jest.fn().mockResolvedValue({ id, isActive: false, tokenVersion: 2 }) };
    const strategy = new JwtStrategy({ getOrThrow: () => 'test-only-secret' } as any, repo as any);
    await expect(strategy.validate({ sub: id, role: Role.CUSTOMER, version: 1 })).rejects.toBeInstanceOf(UnauthorizedException);
    repo.findOne.mockResolvedValue({ id, isActive: true, tokenVersion: 2 });
    await expect(strategy.validate({ sub: id, role: Role.CUSTOMER, version: 1 })).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
