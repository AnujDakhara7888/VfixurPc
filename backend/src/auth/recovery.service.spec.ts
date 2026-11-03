import { RecoveryService } from './recovery.service';
import { createHmac } from 'crypto';

describe('Password recovery', () => {
  const manager = { query: jest.fn() };
  const db: any = { query: jest.fn(), transaction: jest.fn(async work => work(manager)) };
  const values: any = { JWT_SECRET: 'test-only-key' };
  const config: any = { get: (key: string) => values[key], getOrThrow: (key: string) => values[key] };
  const emailOtp: any = { isConfigured: jest.fn(() => true), send: jest.fn(async () => {}) };
  const service = new RecoveryService(db, config, emailOtp);

  beforeEach(() => {
    jest.clearAllMocks();
    emailOtp.isConfigured.mockReturnValue(true);
    emailOtp.send.mockResolvedValue(undefined);
    manager.query.mockResolvedValue([]);
    db.query.mockResolvedValue([]);
  });

  it('uses the registered email and stores a ten-minute, rate-limited reset challenge', async () => {
    db.query
      .mockResolvedValueOnce([{ id: 'one', email: 'a@example.com' }])
      .mockResolvedValueOnce([{ user_id: 'one' }]);
    expect(service.settings()).toEqual({ email: true, sms: false });
    await service.request(' A@example.com ');
    expect(emailOtp.send).toHaveBeenCalledWith('a@example.com', expect.stringMatching(/^\d{6}$/), 'password-reset');
    expect(db.query.mock.calls[1][0]).toContain("interval '10 minutes'");
    expect(db.query.mock.calls[1][0]).toContain("interval '60 seconds'");
  });

  it('fails explicitly when email recovery is not configured', async () => {
    emailOtp.isConfigured.mockReturnValue(false);
    await expect(service.request('a@example.com')).rejects.toThrow('not configured');
    expect(db.query).not.toHaveBeenCalled();
  });

  it('returns the same public result for unknown and active accounts; never returns a code', async () => {
    const unknown = await service.request('a@example.com');
    db.query
      .mockResolvedValueOnce([{ id: 'one', email: 'a@example.com' }])
      .mockResolvedValueOnce([{ user_id: 'one' }]);
    const known = await service.request('a@example.com');
    expect(known).toEqual(unknown);
    expect(Object.keys(known)).toEqual(['message']);
    expect(emailOtp.send).toHaveBeenCalledTimes(1);
  });

  it('removes only the matching challenge on provider failure', async () => {
    db.query
      .mockResolvedValueOnce([{ id: 'one', email: 'a@example.com' }])
      .mockResolvedValueOnce([{ user_id: 'one' }]);
    emailOtp.send.mockRejectedValueOnce(new Error('provider'));
    await service.request('a@example.com');
    expect(db.query).toHaveBeenLastCalledWith(
      'DELETE FROM password_resets WHERE user_id = $1 AND digest = $2',
      ['one', expect.any(String)],
    );
  });

  it('rejects expired, exhausted, or absent codes', async () => {
    await expect(service.reset('a@example.com', '123456', 'new-password')).rejects.toThrow('Invalid or expired');
    expect(manager.query.mock.calls[0][0]).toContain('p.attempts < 5 FOR UPDATE');
    expect(manager.query).toHaveBeenCalledTimes(1);
  });

  it('persists a failed attempt without changing the password', async () => {
    manager.query.mockResolvedValueOnce([{ user_id: 'one', digest: 'wrong' }]);
    await expect(service.reset('a@example.com', '123456', 'new-password')).rejects.toThrow('Invalid or expired');
    expect(manager.query).toHaveBeenLastCalledWith(
      'UPDATE password_resets SET attempts = attempts + 1 WHERE user_id = $1',
      ['one'],
    );
  });

  it('consumes a valid code and revokes all old sessions atomically', async () => {
    const digest = createHmac('sha256', values.JWT_SECRET).update('one:123456').digest('hex');
    manager.query.mockResolvedValueOnce([{ user_id: 'one', digest }]);
    await service.reset('A@example.com', '123456', 'new-password');
    expect(manager.query.mock.calls[1][0]).toContain('token_version = token_version + 1');
    expect(manager.query.mock.calls[1][1][1]).not.toBe('new-password');
    expect(manager.query).toHaveBeenLastCalledWith('DELETE FROM password_resets WHERE user_id = $1', ['one']);
  });
});
