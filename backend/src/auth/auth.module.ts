import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { User } from '../users/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { RecoveryService } from './recovery.service';
import { EmailModule } from '../email/email.module';
import { AccountDeletionService } from './account-deletion.service';
import { EmailOtpService } from './email-otp.service';

@Module({
  imports: [
    EmailModule,
    NotificationsModule,
    TypeOrmModule.forFeature([User]),
    PassportModule,
    JwtModule.register({}),
  ],
  providers: [AuthService, JwtStrategy, RecoveryService, AccountDeletionService, EmailOtpService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
