import {
  Injectable, ConflictException, UnauthorizedException, BadRequestException, ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '../users/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Role } from '../common/enums';
import { NotificationsService } from '../notifications/notifications.service';
import { WebPushService } from '../notifications/web-push.service';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'crypto';
import { EmailOtpService } from './email-otp.service';

// A valid bcrypt hash keeps unknown-user login timing close to wrong-password timing.
const DUMMY_PASSWORD_HASH = '$2b$12$gIPUMf884jfxKkUV2skJiunQZy9buz5eDxeqfdnQioAZlNx0TFyjG';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private jwtService: JwtService,
    private config: ConfigService,
    private notifications: NotificationsService,
    private webPush: WebPushService,
    private emailOtp: EmailOtpService,
  ) {}

  async register(dto: RegisterDto, role: Role = Role.CUSTOMER) {
    if (Buffer.byteLength(dto.password, 'utf8') > 72) throw new BadRequestException('Password is too long. Use at most 72 UTF-8 bytes.');
    const profile = this.normalizeRegistration(dto);
    const referredByUserId = await this.validateRegistration(profile);

    if (role !== Role.CUSTOMER) {
      const user = await this.createRegisteredUser(profile, role, referredByUserId);
      return this.generateTokens(user);
    }
    if (!this.emailOtp.isConfigured()) {
      throw new ServiceUnavailableException('Email verification is temporarily unavailable. Please contact VfixurPC support.');
    }

    const id = randomUUID();
    const code = randomInt(100000, 1000000).toString();
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const digest = this.registrationDigest(id, profile.email, code);

    await this.userRepo.manager.transaction(async manager => {
      await manager.query(`DELETE FROM registration_otp_challenges
        WHERE expires_at < now() OR consumed_at IS NOT NULL OR email=$1 OR phone=$2 OR username=$3`,
      [profile.email, profile.phone, profile.username]);
      await manager.query(`INSERT INTO registration_otp_challenges
        (id,name,email,phone,username,password_hash,date_of_birth,referral_username,digest,expires_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now()+interval '10 minutes')`, [
        id, profile.name, profile.email, profile.phone, profile.username, passwordHash,
        profile.dateOfBirth ?? null, profile.referralUsername ?? null, digest,
      ]);
    });

    try {
      await this.emailOtp.send(profile.email, code, 'registration');
    } catch (error) {
      await this.userRepo.manager.query('DELETE FROM registration_otp_challenges WHERE id=$1', [id]);
      throw error;
    }

    const maskedEmail = this.maskEmail(profile.email);
    return {
      requiresOtp: true as const,
      challengeId: id,
      maskedEmail,
      // Temporary compatibility for installed builds that predate email OTP.
      maskedPhone: maskedEmail,
      channel: 'email' as const,
      expiresInSeconds: 600,
    };
  }

  private normalizeRegistration(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const username = dto.username.trim().toLowerCase();
    const phone = dto.phone.trim();
    return {
      name: dto.name.trim(), email, username, phone, password: dto.password,
      dateOfBirth: dto.dateOfBirth, referralUsername: dto.referralUsername?.trim().toLowerCase(),
    };
  }

  private async validateRegistration(profile: ReturnType<AuthService['normalizeRegistration']>, repository = this.userRepo) {
    const [emailExists, usernameExists, phoneExists] = await Promise.all([
      repository.exists({ where: { email: profile.email } }),
      repository.exists({ where: { username: profile.username } }),
      repository.exists({ where: { phone: profile.phone } }),
    ]);

    if (emailExists) throw new ConflictException('Email already in use');
    if (usernameExists) throw new ConflictException('Username already in use');
    if (phoneExists) throw new ConflictException('Phone number already in use');

    let referredByUserId: string | null = null;
    if (profile.referralUsername) {
      if (profile.referralUsername === profile.username) throw new ConflictException('Referral username must belong to another customer');
      const referrer = await repository.findOne({ where: { username: profile.referralUsername, role: Role.CUSTOMER, isActive: true } });
      if (!referrer) throw new ConflictException('Referral username was not found');
      referredByUserId = referrer.id;
    }
    return referredByUserId;
  }

  private async createRegisteredUser(
    profile: ReturnType<AuthService['normalizeRegistration']>,
    role: Role,
    referredByUserId: string | null,
    repository = this.userRepo,
    passwordHash?: string,
  ) {
    const user = repository.create({
      name: profile.name,
      email: profile.email,
      username: profile.username,
      phone: profile.phone,
      dateOfBirth: profile.dateOfBirth ?? null,
      passwordHash: passwordHash ?? await bcrypt.hash(profile.password, 12),
      role,
      referredByUserId,
    });
    return repository.save(user);
  }

  private registrationDigest(challengeId: string, email: string, code: string) {
    return createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET'))
      .update(`${challengeId}:${email}:${code}`).digest('hex');
  }

  async verifyRegistrationOtp(challengeId: string, code: string) {
    const user = await this.userRepo.manager.transaction(async manager => {
      const rows = await manager.query(`SELECT * FROM registration_otp_challenges
        WHERE id=$1 AND consumed_at IS NULL AND expires_at > now() AND attempts < 5 FOR UPDATE`, [challengeId]);
      if (!rows.length) return null;
      const challenge = rows[0];
      const expected = this.registrationDigest(challengeId, challenge.email, code);
      if (!this.safeEqual(challenge.digest, expected)) {
        await manager.query('UPDATE registration_otp_challenges SET attempts=attempts+1 WHERE id=$1', [challengeId]);
        return null;
      }

      const profile = {
        name: challenge.name,
        email: challenge.email,
        phone: challenge.phone,
        username: challenge.username,
        password: '',
        dateOfBirth: challenge.date_of_birth ?? undefined,
        referralUsername: challenge.referral_username ?? undefined,
      };
      const repository = manager.getRepository(User);
      const referredByUserId = await this.validateRegistration(profile, repository);
      const created = await this.createRegisteredUser(profile, Role.CUSTOMER, referredByUserId, repository, challenge.password_hash);
      await manager.query('UPDATE registration_otp_challenges SET consumed_at=now() WHERE id=$1', [challengeId]);
      return created;
    });

    if (!user) throw new BadRequestException('Invalid or expired verification code.');
    await this.notifications.notifyAdmins('New customer account: ' + user.name + '.').catch(() => {});
    return this.generateTokens(user);
  }

  async resendRegistrationOtp(challengeId: string) {
    const rows = await this.userRepo.manager.query(`SELECT email FROM registration_otp_challenges
      WHERE id=$1 AND consumed_at IS NULL AND expires_at > now()
      AND requested_at < now()-interval '60 seconds'`, [challengeId]);
    if (!rows.length) throw new BadRequestException('Wait 60 seconds or restart account creation.');
    const code = randomInt(100000, 1000000).toString();
    const digest = this.registrationDigest(challengeId, rows[0].email, code);
    await this.emailOtp.send(rows[0].email, code, 'registration');
    await this.userRepo.manager.query(`UPDATE registration_otp_challenges
      SET digest=$2,expires_at=now()+interval '10 minutes',requested_at=now(),attempts=0 WHERE id=$1`, [challengeId, digest]);
    return { message: 'A new email verification code was sent.', expiresInSeconds: 600 };
  }

  async login(dto: LoginDto) {
    if (Buffer.byteLength(dto.password, 'utf8') > 72) throw new UnauthorizedException('Invalid credentials');
    const user = await this.userRepo.createQueryBuilder('user').addSelect('user.passwordHash')
      .where('user.username = :username', { username: dto.username.trim().toLowerCase() }).getOne();
    if (!user) {
      await bcrypt.compare(dto.password, DUMMY_PASSWORD_HASH);
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (user.isActive === false) {
      throw new UnauthorizedException('Your account has been deactivated. Contact an administrator.');
    }

    const customerOtpEnabled = this.config.get<string>('CUSTOMER_LOGIN_OTP_ENABLED', 'true') !== 'false';
    if (user.role !== Role.CUSTOMER || !customerOtpEnabled) {
      return this.generateTokens(user);
    }
    if (!this.reviewerOtpFor(user) && !this.emailOtp.isConfigured()) {
      throw new ServiceUnavailableException('Email verification is temporarily unavailable. Please contact VfixurPC support.');
    }
    return this.createLoginChallenge(user);
  }

  private loginDigest(userId: string, challengeId: string, code: string) {
    return createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET'))
      .update(`${userId}:${challengeId}:${code}`).digest('hex');
  }

  private safeEqual(left: string, right: string) {
    const a = Buffer.from(left), b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private maskEmail(email: string) {
    const [local, domain] = email.split('@');
    if (!domain) return 'your registered email';
    const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
    return `${visible}${'*'.repeat(Math.max(3, Math.min(8, local.length - visible.length)))}@${domain}`;
  }

  private reviewerOtpFor(user: Pick<User, 'username' | 'role'>) {
    const username = this.config.get<string>('PLAY_REVIEW_USERNAME', '').trim().toLowerCase();
    const code = this.config.get<string>('PLAY_REVIEW_OTP', '').trim();
    if (user.role !== Role.CUSTOMER || !username || user.username.toLowerCase() !== username) return null;
    return /^\d{6}$/.test(code) ? code : null;
  }

  private async createLoginChallenge(user: User) {
    const id = randomUUID();
    const reviewerCode = this.reviewerOtpFor(user);
    const code = reviewerCode ?? randomInt(100000, 1000000).toString();
    const digest = this.loginDigest(user.id, id, code);
    await this.userRepo.manager.transaction(async manager => {
      await manager.query(`DELETE FROM login_otp_challenges WHERE user_id=$1 AND (consumed_at IS NOT NULL OR expires_at < now() OR requested_at < now() - interval '1 day')`, [user.id]);
      await manager.query(`INSERT INTO login_otp_challenges (id,user_id,digest,expires_at)
        VALUES ($1,$2,$3,now()+interval '10 minutes')`, [id, user.id, digest]);
    });
    if (!reviewerCode) {
      try { await this.emailOtp.send(user.email, code, 'login'); }
      catch (error) {
        await this.userRepo.manager.query('DELETE FROM login_otp_challenges WHERE id=$1', [id]);
        throw error;
      }
    }
    const maskedEmail = this.maskEmail(user.email);
    return {
      requiresOtp: true, challengeId: id, maskedEmail,
      // Temporary compatibility for installed builds that predate email OTP.
      maskedPhone: maskedEmail,
      channel: 'email' as const, expiresInSeconds: 600,
    };
  }

  async verifyLoginOtp(challengeId: string, code: string) {
    const userId = await this.userRepo.manager.transaction(async manager => {
      const rows = await manager.query(`SELECT user_id,digest FROM login_otp_challenges
        WHERE id=$1 AND consumed_at IS NULL AND expires_at > now() AND attempts < 5 FOR UPDATE`, [challengeId]);
      if (!rows.length) return null;
      const expected = this.loginDigest(rows[0].user_id, challengeId, code);
      if (!this.safeEqual(rows[0].digest, expected)) {
        await manager.query('UPDATE login_otp_challenges SET attempts=attempts+1 WHERE id=$1', [challengeId]);
        return null;
      }
      await manager.query('UPDATE login_otp_challenges SET consumed_at=now() WHERE id=$1', [challengeId]);
      return rows[0].user_id as string;
    });
    if (!userId) throw new BadRequestException('Invalid or expired verification code.');
    const user = await this.userRepo.findOne({ where: { id: userId, isActive: true } });
    if (!user) throw new UnauthorizedException();
    return this.generateTokens(user);
  }

  async resendLoginOtp(challengeId: string) {
    const rows = await this.userRepo.manager.query(`SELECT c.user_id,u.email,u.username,u.role FROM login_otp_challenges c
      JOIN users u ON u.id=c.user_id WHERE c.id=$1 AND c.consumed_at IS NULL AND c.expires_at > now()
      AND c.requested_at < now()-interval '60 seconds' AND u.is_active=true`, [challengeId]);
    if (!rows.length) throw new BadRequestException('Wait 60 seconds or restart sign in.');
    const reviewerCode = this.reviewerOtpFor(rows[0]);
    const code = reviewerCode ?? randomInt(100000, 1000000).toString();
    const digest = this.loginDigest(rows[0].user_id, challengeId, code);
    if (!reviewerCode) await this.emailOtp.send(rows[0].email, code, 'login');
    await this.userRepo.manager.query(`UPDATE login_otp_challenges SET digest=$2,expires_at=now()+interval '10 minutes',requested_at=now(),attempts=0 WHERE id=$1`, [challengeId, digest]);
    return { message: 'A new verification code was sent.', expiresInSeconds: 600 };
  }

  private emailChangeDigest(userId: string, challengeId: string, email: string, code: string) {
    return createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET'))
      .update(`${userId}:${challengeId}:${email}:${code}`).digest('hex');
  }

  async requestEmailChange(userId: string, rawEmail: string, password: string) {
    if (!this.emailOtp.isConfigured()) {
      throw new ServiceUnavailableException('Email verification is temporarily unavailable. Please contact VfixurPC support.');
    }
    if (Buffer.byteLength(password, 'utf8') > 72) throw new UnauthorizedException('Password is incorrect');
    const newEmail = rawEmail.trim().toLowerCase();
    const user = await this.userRepo.createQueryBuilder('user').addSelect('user.passwordHash')
      .where('user.id = :userId AND user.isActive = true', { userId }).getOne();
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Password is incorrect');
    }
    if (newEmail === user.email.toLowerCase()) throw new BadRequestException('Enter a different email address');
    if (await this.userRepo.exists({ where: { email: newEmail, id: Not(userId) } })) {
      throw new ConflictException('Email already in use');
    }

    const challengeId = randomUUID();
    const code = randomInt(100000, 1000000).toString();
    const digest = this.emailChangeDigest(userId, challengeId, newEmail, code);
    const created = await this.userRepo.manager.transaction(async manager => {
      await manager.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId]);
      const recent = await manager.query(`SELECT id FROM email_change_challenges
        WHERE user_id=$1 AND consumed_at IS NULL AND requested_at > now()-interval '60 seconds'`, [userId]);
      if (recent.length) return false;
      await manager.query('DELETE FROM email_change_challenges WHERE user_id=$1', [userId]);
      await manager.query(`INSERT INTO email_change_challenges
        (id,user_id,new_email,digest,expires_at) VALUES ($1,$2,$3,$4,now()+interval '10 minutes')`,
      [challengeId, userId, newEmail, digest]);
      return true;
    });
    if (!created) throw new BadRequestException('Wait 60 seconds before requesting another code.');
    try {
      await this.emailOtp.send(newEmail, code, 'email-change');
    } catch (error) {
      await this.userRepo.manager.query('DELETE FROM email_change_challenges WHERE id=$1', [challengeId]);
      throw error;
    }
    return { challengeId, maskedEmail: this.maskEmail(newEmail), expiresInSeconds: 600 };
  }

  async verifyEmailChange(userId: string, challengeId: string, code: string) {
    const outcome = await this.userRepo.manager.transaction(async manager => {
      const rows = await manager.query(`SELECT id,new_email,digest FROM email_change_challenges
        WHERE id=$1 AND user_id=$2 AND consumed_at IS NULL AND expires_at > now() AND attempts < 5 FOR UPDATE`,
      [challengeId, userId]);
      if (!rows.length) return 'invalid';
      const challenge = rows[0];
      const expected = this.emailChangeDigest(userId, challengeId, challenge.new_email, code);
      if (!this.safeEqual(challenge.digest, expected)) {
        await manager.query('UPDATE email_change_challenges SET attempts=attempts+1 WHERE id=$1', [challengeId]);
        return 'invalid';
      }
      const duplicate = await manager.query('SELECT id FROM users WHERE LOWER(email)=LOWER($1) AND id<>$2 LIMIT 1',
        [challenge.new_email, userId]);
      if (duplicate.length) return 'duplicate';
      await manager.query(`UPDATE users SET email=$2,refresh_token=NULL,token_version=token_version+1,updated_at=now()
        WHERE id=$1 AND is_active=true`, [userId, challenge.new_email]);
      await manager.query('UPDATE email_change_challenges SET consumed_at=now() WHERE id=$1', [challengeId]);
      await manager.query('DELETE FROM login_otp_challenges WHERE user_id=$1', [userId]);
      return 'updated';
    });
    if (outcome === 'duplicate') throw new ConflictException('Email already in use');
    if (outcome !== 'updated') throw new BadRequestException('Invalid or expired verification code.');
    const user = await this.userRepo.findOne({ where: { id: userId, isActive: true } });
    if (!user) throw new UnauthorizedException();
    return this.generateTokens(user);
  }

  async refreshToken(refreshToken: string) {
    let payload: { sub: string; version?: number };
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token invalid');
    }

    const userId = payload.sub;
    const user = await this.userRepo.createQueryBuilder('user').addSelect('user.refreshToken')
      .where('user.id = :id', { id: userId }).getOne();
    if (!user || !user.isActive || !user.refreshToken) throw new UnauthorizedException();
    if ((payload.version ?? 0) !== (user.tokenVersion ?? 0)) throw new UnauthorizedException();

    const match = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!match) throw new UnauthorizedException('Refresh token invalid');

    return this.generateTokens(user);
  }

  async logout(userId: string) {
    await this.userRepo.update(userId, { refreshToken: null, fcmToken: '' });
    await this.webPush.removeForUser(userId);
  }

  async updateFcmToken(userId: string, fcmToken: string) {
    await this.userRepo.manager.transaction(async manager => {
      await manager.update(User, { fcmToken, id: Not(userId) }, { fcmToken: '' });
      await manager.update(User, userId, { fcmToken });
    });
  }

  private async generateTokens(user: User) {
    const payload = { sub: user.id, role: user.role, version: user.tokenVersion ?? 0 };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.getOrThrow<string>('JWT_SECRET'),
      expiresIn: this.config.get('JWT_EXPIRES_IN', '15m'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    const hashedRefresh = await bcrypt.hash(refreshToken, 10);
    await this.userRepo.update(user.id, { refreshToken: hashedRefresh });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        username: user.username,
        role: user.role,
        dateOfBirth: user.dateOfBirth,
      },
    };
  }
}
