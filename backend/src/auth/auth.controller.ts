import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus, Patch } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators';
import { User } from '../users/user.entity';
import { IsString, IsNotEmpty } from 'class-validator';

class RefreshDto {
  @IsString() @IsNotEmpty() refreshToken: string;
}

class FcmTokenDto {
  @IsString() @IsNotEmpty() fcmToken: string;
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
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
  updateFcmToken(@CurrentUser() user: User, @Body() dto: FcmTokenDto) {
    return this.authService.updateFcmToken(user.id, dto.fcmToken);
  }
}
