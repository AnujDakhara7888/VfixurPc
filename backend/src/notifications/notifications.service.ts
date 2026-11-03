import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { Notification } from './notification.entity';
import {
  NotificationType,
  NotificationStatus,
  ServiceRequestStatus,
  Role,
} from '../common/enums';
import { User } from '../users/user.entity';
import { WebPushService } from './web-push.service';
import { EmailService } from '../email/email.service';
import { formatCustomerDates } from './dateTime';

export const STATUS_MESSAGES: Partial<Record<ServiceRequestStatus, string>> = {
  REQUEST_RECEIVED: 'Your service request has been received. Ticket: {ticket}.',
  DIAGNOSING: 'Diagnosis has started. Ticket: {ticket}.',
  AWAITING_PARTS:
    'Your repair is awaiting parts. We will keep you updated. Ticket: {ticket}.',
  TESTING: 'Your device is being tested after repair. Ticket: {ticket}.',
  READY_FOR_HANDOVER:
    'Your device is ready for collection or delivery. Ticket: {ticket}.',
  CANCELLED: 'Your service request was cancelled. Ticket: {ticket}.',
  PICKUP_SCHEDULED:
    'Your appointment is confirmed for {date}. Ticket: {ticket}.',
  PICKED_UP:
    'Your device has been picked up. We will share your quotation within 48 hours of workshop receipt. Ticket: {ticket}.',
  RECEIVED_AT_WORKSHOP:
    'Your device is safely at our workshop. We will share your quotation within 48 hours. Ticket: {ticket}.',
  DIAGNOSED:
    'Diagnosis is complete. Your quotation is being prepared. Ticket: {ticket}.',
  QUOTATION_SHARED:
    'Your quotation is ready. Please review and approve or request a return in the app. Ticket: {ticket}.',
  UNDER_REPAIR: 'Your approved repair is in progress. Ticket: {ticket}.',
  REPAIR_COMPLETE:
    'Your repair is complete and preparing for handover. Ticket: {ticket}.',
  OUT_FOR_DELIVERY: 'Your device is out for delivery. Ticket: {ticket}.',
  DELIVERED:
    'Your device has been delivered. Thank you for choosing VfixurPC! Ticket: {ticket}.',
};
const FIELD_SERVICE_CATEGORIES = new Set(['cctv', 'network', 'backup', 'custom', 'business']);
const PROJECT_STATUS_MESSAGES: Partial<Record<ServiceRequestStatus, string>> = {
  REQUEST_RECEIVED: 'Your project request has been received. Ticket: {ticket}.',
  PICKUP_SCHEDULED: 'Your site appointment is confirmed for {date}. Ticket: {ticket}.',
  PICKED_UP: 'Your scheduled site visit is underway. Ticket: {ticket}.',
  RECEIVED_AT_WORKSHOP: 'Your project assessment is underway. Ticket: {ticket}.',
  DIAGNOSING: 'Your site and requirements assessment has started. Ticket: {ticket}.',
  DIAGNOSED: 'The assessment is complete and your proposal is being prepared. Ticket: {ticket}.',
  QUOTATION_SHARED: 'Your project proposal is ready. Please review it in the app. Ticket: {ticket}.',
  AWAITING_PARTS: 'Equipment and project scheduling are being arranged. Ticket: {ticket}.',
  UNDER_REPAIR: 'Your approved project work is in progress. Ticket: {ticket}.',
  TESTING: 'Configuration and quality validation are in progress. Ticket: {ticket}.',
  REPAIR_COMPLETE: 'Project work is complete and handover is being prepared. Ticket: {ticket}.',
  READY_FOR_HANDOVER: 'Your project is ready for final handover. Ticket: {ticket}.',
  OUT_FOR_DELIVERY: 'Equipment is on its way for final handover. Ticket: {ticket}.',
  DELIVERED: 'Your project is complete. Thank you for choosing VfixurPC! Ticket: {ticket}.',
};
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  constructor(
    @InjectRepository(Notification) private notifRepo: Repository<Notification>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private config: ConfigService,
    private webPush: WebPushService,
    private email: EmailService,
  ) {
    if (!getApps().length) {
      try {
        const account = JSON.parse(
          config.get('FIREBASE_SERVICE_ACCOUNT') || '{}',
        );
        if (account.project_id)
          initializeApp({ credential: cert(account) });
      } catch {
        this.logger.warn('Firebase credentials are not configured');
      }
    }
  }
  async triggerStatusNotification(
    status: ServiceRequestStatus,
    user: User,
    srId: string,
    ticket: string,
    date?: string,
    serviceCategory?: string,
  ) {
    const template = FIELD_SERVICE_CATEGORIES.has(serviceCategory ?? '')
      ? PROJECT_STATUS_MESSAGES[status] ?? STATUS_MESSAGES[status]
      : STATUS_MESSAGES[status];
    if (template)
      await this.notify(
        user,
        template
          .replace('{ticket}', ticket)
          .replace('{date}', date ? formatCustomerDates(date) : 'your chosen slot'),
        srId,
      );
  }
  // One inbox event regardless of whether an external channel is available.
  async notify(user: User, message: string, serviceRequestId?: string, options?: { title?: string; offerId?: string; deepLink?: string }) {
    message = formatCustomerDates(message);
    const event = await this.notifRepo.save(
      this.notifRepo.create({
        userId: user.id,
        serviceRequestId,
        title: options?.title ?? null,
        offerId: options?.offerId ?? null,
        deepLink: options?.deepLink ?? null,
        message,
        type: NotificationType.PUSH,
        status: NotificationStatus.PENDING,
      }),
    );
    if ([Role.SUPER_ADMIN, Role.OPERATIONS].includes(user.role))
      await this.webPush.send(user.id, event.id, serviceRequestId).catch(() => this.logger.warn('Browser notification failed; inbox retained'));
    if (user.fcmToken === undefined) {
      const tokenOwner = await this.userRepo.findOne({ where: { id: user.id }, select: { id: true, fcmToken: true } });
      user.fcmToken = tokenOwner?.fcmToken ?? '';
    }
    if (!user.fcmToken) return event;
    try {
      const { count } = await this.unreadCount(user.id);
      const data = {
        notificationId: event.id,
        serviceRequestId: serviceRequestId ?? '',
        offerId: options?.offerId ?? '',
        deepLink: options?.deepLink ?? '',
      };
      if (/^(Expo|Exponent)PushToken\[/.test(user.fcmToken)) {
        const result = await axios.post(
          'https://exp.host/--/api/v2/push/send',
          {
            to: user.fcmToken,
            title: options?.title ?? 'VfixurPC',
            body: message,
            data,
            sound: 'default',
            badge: count,
            channelId: 'default',
            priority: 'high',
          },
          { timeout: 3000 },
        );
        if (result.data?.data?.status !== 'ok')
          throw new Error('Push service rejected notification');
      } else if (getApps().length) {
        await getMessaging().send({
          token: user.fcmToken,
          notification: { title: options?.title ?? 'VfixurPC', body: message },
          data,
          android: {
            priority: 'high',
            notification: {
              channelId: 'default',
              sound: 'default',
              notificationCount: count,
            },
          },
          apns: { payload: { aps: { sound: 'default', badge: count } } },
        });
      } else return event;
      await this.notifRepo.update(event.id, {
        status: NotificationStatus.SENT,
      });
      event.status = NotificationStatus.SENT;
    } catch (error) {
      this.logger.warn(
        'Push delivery failed for event ' + event.id + ' (' + (error?.code ?? 'provider-error') + '); inbox event retained',
      );
      await this.notifRepo.update(event.id, {
        status: NotificationStatus.FAILED,
      });
      event.status = NotificationStatus.FAILED;
      if (error?.code === 'messaging/registration-token-not-registered')
        await this.userRepo.update({id: user.id, fcmToken: user.fcmToken}, {fcmToken: ''});
    }
    return event;
  }
  recordExternal(user: User, message: string, type: NotificationType, options?: { title?: string; offerId?: string; deepLink?: string }) {
    return this.notifRepo.save(this.notifRepo.create({
      userId: user.id,
      message: formatCustomerDates(message),
      type,
      title: options?.title ?? null,
      offerId: options?.offerId ?? null,
      deepLink: options?.deepLink ?? null,
      status: NotificationStatus.SENT,
    }));
  }
  async nativeSettings(user: User) {
    const tokenOwner = await this.userRepo.findOne({ where: { id: user.id }, select: { id: true, fcmToken: true } });
    return { registered: !!tokenOwner?.fcmToken, androidConfigured: !!getApps().length };
  }
  async setPromotionalPreference(userId: string, enabled: boolean) {
    await this.userRepo.update(userId, { promotionalPushOptIn: enabled });
  }
  async setWhatsAppPreference(userId: string, enabled: boolean) {
    await this.userRepo.update(userId, { promotionalWhatsappOptIn: enabled });
  }
  async testNative(user: User) {
    if (user.fcmToken === undefined) {
      const tokenOwner = await this.userRepo.findOne({ where: { id: user.id }, select: { id: true, fcmToken: true } });
      user.fcmToken = tokenOwner?.fcmToken ?? '';
    }
    if (!user.fcmToken) throw new BadRequestException('Enable notifications on this device first.');
    const event = await this.notify(user, 'This is your VfixurPC notification test.');
    return { accepted: event.status === NotificationStatus.SENT };
  }
  async notifyAdmins(message: string, serviceRequestId?: string) {
    message = formatCustomerDates(message);
    const users = await this.userRepo.find({
      where: { role: In([Role.SUPER_ADMIN, Role.OPERATIONS]), isActive: true },
      select: { id: true, role: true, fcmToken: true },
    });
    const results = await Promise.allSettled(
      users.map((user) => this.notify(user, message, serviceRequestId)),
    );
    if (results.some(result => result.status === 'rejected')) this.logger.error('An admin inbox event could not be persisted');
    const recipients = (
      this.config.get<string>('ADMIN_NOTIFICATION_EMAILS') ?? ''
    )
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!this.email.isConfigured() || !recipients.length) {
      this.logger.warn('Admin email not configured; customer activity is available in the admin inbox');
      return;
    }
    const url = this.config.get<string>('ADMIN_PUBLIC_URL');
    try {
      await this.email.send(
        {
          to: recipients,
          subject: 'VfixurPC: customer update',
          text:
            message +
            (url && serviceRequestId
              ? '\n\n' +
                url.replace(/\/$/, '') +
                '/dashboard/service-requests/' +
                serviceRequestId
              : ''),
        },
      );
    } catch {
      this.logger.warn('Admin email failed; admin inbox events retained');
    }
  }
  emailSettings() {
    return { configured: !!(this.email.isConfigured() && this.config.get<string>('ADMIN_NOTIFICATION_EMAILS')?.trim()) };
  }
  async findByUser(userId: string) {
    const rows = await this.notifRepo.find({
      where: { userId },
      order: { sentAt: 'DESC' },
      take: 100,
    });
    return rows.map((row) => ({ ...row, message: formatCustomerDates(row.message), createdAt: row.sentAt }));
  }
  async unreadCount(userId: string) {
    return {
      count: await this.notifRepo.count({
        where: { userId, readAt: IsNull() },
      }),
    };
  }
  async markRead(userId: string, id?: string) {
    await this.notifRepo.update(
      { userId, readAt: IsNull(), ...(id ? { id } : {}) },
      { readAt: new Date() },
    );
    return this.unreadCount(userId);
  }
}
