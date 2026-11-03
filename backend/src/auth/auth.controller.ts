import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus, Patch, Get, Delete } from '@nestjs/common';
import { AccountDeletionService } from './account-deletion.service';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators';
import { User } from '../users/user.entity';
import { IsEmail, IsString, IsNotEmpty, IsUUID, Length, Matches, MaxLength } from 'class-validator';
import { RecoveryService } from './recovery.service';
import { Throttle } from '@nestjs/throttler';

class RecoveryRequestDto { @IsString() @MaxLength(254) identifier: string; }
class DeleteAccountDto {
  @IsString() @Length(1, 64) password: string;
  @IsString() @Matches(/^DELETE$/) confirmation: string;
}
class RecoveryResetDto extends RecoveryRequestDto {
  @IsString() @Matches(/^\d{6}$/) code: string;
  @IsString() @Length(8, 64) password: string;
}
class LoginOtpDto {
  @IsUUID() challengeId: string;
  @IsString() @Matches(/^\d{6}$/) code: string;
}
class LoginOtpResendDto { @IsUUID() challengeId: string; }
class EmailChangeRequestDto {
  @IsEmail() @MaxLength(254) newEmail: string;
  @IsString() @Length(1, 64) password: string;
}
class EmailChangeVerifyDto {
  @IsUUID() challengeId: string;
  @IsString() @Matches(/^\d{6}$/) code: string;
}

class RefreshDto {
  @IsString() @IsNotEmpty() refreshToken: string;
}

class FcmTokenDto {
  @IsString() @IsNotEmpty() @MaxLength(4096) fcmToken: string;
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService, private recovery: RecoveryService, private deletion: AccountDeletionService) {}

  @Delete('account') @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  deleteAccount(@CurrentUser() user: User, @Body() dto: DeleteAccountDto) {
    return this.deletion.delete(user.id, dto.password);
  }

  @Get('recovery-settings')
  recoverySettings() { return this.recovery.settings(); }

  @Post('forgot-password') @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  forgot(@Body() dto: RecoveryRequestDto) { return this.recovery.request(dto.identifier); }

  @Post('reset-password') @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  reset(@Body() dto: RecoveryResetDto) { return this.recovery.reset(dto.identifier, dto.code, dto.password); }

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('register/verify-otp') @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  verifyRegistrationOtp(@Body() dto: LoginOtpDto) {
    return this.authService.verifyRegistrationOtp(dto.challengeId, dto.code);
  }

  @Post('register/resend-otp') @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  resendRegistrationOtp(@Body() dto: LoginOtpResendDto) {
    return this.authService.resendRegistrationOtp(dto.challengeId);
  }

  @Post('login')
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('login/verify-otp') @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  verifyLoginOtp(@Body() dto: LoginOtpDto) { return this.authService.verifyLoginOtp(dto.challengeId, dto.code); }

  @Post('login/resend-otp') @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  resendLoginOtp(@Body() dto: LoginOtpResendDto) { return this.authService.resendLoginOtp(dto.challengeId); }

  @Post('email-change/request') @UseGuards(JwtAuthGuard) @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  requestEmailChange(@CurrentUser() user: User, @Body() dto: EmailChangeRequestDto) {
    return this.authService.requestEmailChange(user.id, dto.newEmail, dto.password);
  }

  @Post('email-change/verify') @UseGuards(JwtAuthGuard) @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  verifyEmailChange(@CurrentUser() user: User, @Body() dto: EmailChangeVerifyDto) {
    return this.authService.verifyEmailChange(user.id, dto.challengeId, dto.code);
  }

  @Post('refresh')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@CurrentUser() user: User) {
    return this.authService.logout(user.id);
  }

  @Patch('fcm-token')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  updateFcmToken(@CurrentUser() user: User, @Body() dto: FcmTokenDto) {
    return this.authService.updateFcmToken(user.id, dto.fcmToken);
  }
}
