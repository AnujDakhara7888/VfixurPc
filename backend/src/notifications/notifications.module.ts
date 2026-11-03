import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { Notification } from './notification.entity';
import { User } from '../users/user.entity';
import { WebPushSubscription } from './web-push.entity';
import { WebPushService } from './web-push.service';
import { NotificationTestGuard } from './notification-test.guard';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule, TypeOrmModule.forFeature([Notification, User, WebPushSubscription])],
  controllers: [NotificationsController],
  providers: [NotificationsService, WebPushService, NotificationTestGuard],
  exports: [NotificationsService, WebPushService],
})
export class NotificationsModule {}
