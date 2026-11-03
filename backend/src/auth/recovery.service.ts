import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import * as bcrypt from 'bcrypt';
import { EmailOtpService } from './email-otp.service';

const RESPONSE = { message: 'If an active account matches, a reset code will be sent to its registered email address.' };
@Injectable()
export class RecoveryService {
  constructor(private db: DataSource, private config: ConfigService, private emailOtp: EmailOtpService) {}
  settings() {
    return { email: this.emailOtp.isConfigured(), sms: false };
  }
  private digest(userId: string, code: string) {
    return createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET')).update(userId + ':' + code).digest('hex');
  }
  async request(rawIdentifier: string) {
    if (!this.settings().email) throw new ServiceUnavailableException('Password recovery email is not configured yet. Contact VfixurPC support.');
    const identifier = rawIdentifier.trim().toLowerCase();
    const [user] = await this.db.query(`SELECT id,email FROM users WHERE is_active=true AND
      (LOWER(email)=$1 OR LOWER(username)=$1 OR phone=$1) LIMIT 1`, [identifier]);
    if (!user) return RESPONSE;
    const code = randomInt(100000, 1000000).toString();
    const digest = this.digest(user.id, code);
    // The conflict predicate applies the resend cooldown across Cloud Run instances.
    const rows = await this.db.query(`INSERT INTO password_resets (user_id, digest, expires_at)
      SELECT id, $2, now() + interval '10 minutes' FROM users WHERE id = $1 AND is_active = true
      ON CONFLICT (user_id) DO UPDATE SET digest = EXCLUDED.digest, expires_at = EXCLUDED.expires_at,
        requested_at = now(), attempts = 0
      WHERE password_resets.requested_at < now() - interval '60 seconds'
      RETURNING user_id`, [user.id, digest]);
    if (rows.length) {
      try {
        await this.emailOtp.send(user.email, code, 'password-reset');
      } catch {
        await this.db.query('DELETE FROM password_resets WHERE user_id = $1 AND digest = $2', [rows[0].user_id, digest]);
        // Keep the public response identical for existing and unknown accounts.
        // Provider details and reset codes must never be logged.
      }
    }
    return RESPONSE;
  }
  async reset(rawIdentifier: string, code: string, password: string) {
    if (Buffer.byteLength(password, 'utf8') > 72) throw new BadRequestException('Password is too long. Use at most 72 UTF-8 bytes.');
    const identifier = rawIdentifier.trim().toLowerCase();
    const hash = await bcrypt.hash(password, 12);
    const accepted = await this.db.transaction(async manager => {
      const rows = await manager.query(`SELECT p.user_id, p.digest FROM password_resets p
        JOIN users u ON u.id = p.user_id WHERE (LOWER(u.email)=$1 OR LOWER(u.username)=$1 OR u.phone=$1) AND u.is_active = true
        AND p.expires_at > now() AND p.attempts < 5 FOR UPDATE OF p`, [identifier]);
      if (!rows.length) return false;
      const digest = this.digest(rows[0].user_id, code);
      const actual = Buffer.from(rows[0].digest ?? '', 'utf8');
      const expected = Buffer.from(digest, 'utf8');
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
        await manager.query('UPDATE password_resets SET attempts = attempts + 1 WHERE user_id = $1', [rows[0].user_id]);
        return false;
      }
      await manager.query(`UPDATE users SET password_hash = $2, refresh_token = NULL,
        token_version = token_version + 1, updated_at = now() WHERE id = $1`, [rows[0].user_id, hash]);
      await manager.query('DELETE FROM password_resets WHERE user_id = $1', [rows[0].user_id]);
      return true;
    });
    if (!accepted) throw new BadRequestException('Invalid or expired code. Request a new code and try again.');
    return { message: 'Password changed. Sign in with your new password.' };
  }
}
