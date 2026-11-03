import { Controller, Get, Post, Delete, Body, Patch, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators';
import { User } from '../users/user.entity';
import { Roles } from '../common/decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '../common/enums';
import { WebPushService } from './web-push.service';
import { IsBoolean, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { randomUUID } from 'crypto';
import { NotificationTestGuard } from './notification-test.guard';
import { Throttle } from '@nestjs/throttler';

class PushKeysDto {
  @IsString() @MaxLength(100) p256dh: string;
  @IsString() @MaxLength(32) auth: string;
}
class PushEndpointDto { @IsString() @MaxLength(2048) endpoint: string; }
class PushSubscriptionDto extends PushEndpointDto {
  @ValidateNested() @Type(() => PushKeysDto) keys: PushKeysDto;
}
class PromotionalPreferenceDto { @IsBoolean() enabled: boolean; }

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private notificationsService: NotificationsService, private webPush: WebPushService) {}

  @Get('native-settings')
  async nativeSettings(@CurrentUser() user: User) { return { ...await this.notificationsService.nativeSettings(user), promotionalPushOptIn: !!user.promotionalPushOptIn, promotionalWhatsappOptIn: !!user.promotionalWhatsappOptIn }; }

  @Patch('promotional-preference')
  async promotionalPreference(@CurrentUser() user: User, @Body() dto: PromotionalPreferenceDto) {
    await this.notificationsService.setPromotionalPreference(user.id, dto.enabled);
    return { promotionalPushOptIn: dto.enabled };
  }

  @Patch('whatsapp-preference')
  async whatsappPreference(@CurrentUser() user: User, @Body() dto: PromotionalPreferenceDto) {
    await this.notificationsService.setWhatsAppPreference(user.id, dto.enabled);
    return { promotionalWhatsappOptIn: dto.enabled };
  }

  @Post('native-test')
  @UseGuards(NotificationTestGuard) @Throttle({ default: { limit: 3, ttl: 60000 } })
  nativeTest(@CurrentUser() user: User) { return this.notificationsService.testNative(user); }

  @Get('delivery-settings')
  @UseGuards(RolesGuard) @Roles(Role.SUPER_ADMIN, Role.OPERATIONS)
  settings() { return { webPush: this.webPush.settings(), email: this.notificationsService.emailSettings() }; }

  @Post('web-push')
  @UseGuards(RolesGuard) @Roles(Role.SUPER_ADMIN, Role.OPERATIONS)
  subscribe(@CurrentUser() user: User, @Body() dto: PushSubscriptionDto) {
    return this.webPush.subscribe(user.id, dto.endpoint, dto.keys);
  }

  @Delete('web-push')
  @UseGuards(RolesGuard) @Roles(Role.SUPER_ADMIN, Role.OPERATIONS)
  unsubscribe(@CurrentUser() user: User, @Body() dto: PushEndpointDto) {
    return this.webPush.unsubscribe(user.id, dto.endpoint);
  }

  @Post('web-push/test')
  @UseGuards(NotificationTestGuard) @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(RolesGuard) @Roles(Role.SUPER_ADMIN, Role.OPERATIONS)
  testPush(@CurrentUser() user: User) {
    return this.webPush.send(user.id, randomUUID());
  }

  @Get('unread-count')
  unread(@CurrentUser() user: User) { return this.notificationsService.unreadCount(user.id); }

  @Patch('read-all')
  readAll(@CurrentUser() user: User) { return this.notificationsService.markRead(user.id); }

  @Patch(':id/read')
  read(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.notificationsService.markRead(user.id, id);
  }

  @Get()
  findMine(@CurrentUser() user: User) {
    return this.notificationsService.findByUser(user.id);
  }
}
