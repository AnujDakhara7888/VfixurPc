import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as admin from 'firebase-admin';
import { Notification } from './notification.entity';
import { NotificationType, NotificationStatus, ServiceRequestStatus } from '../common/enums';
import { User } from '../users/user.entity';

// Trigger map: what to send and to whom at each status change
const STATUS_MESSAGES: Partial<Record<ServiceRequestStatus, { sms: boolean; push: boolean; template: string }>> = {
  [ServiceRequestStatus.PICKUP_SCHEDULED]: { sms: true, push: true, template: 'Your booking is confirmed! Ticket: {ticket}. Our agent will pick up your device on {date}.' },
  [ServiceRequestStatus.PICKED_UP]: { sms: true, push: true, template: 'Your device has been picked up. Ticket: {ticket}. We will diagnose it and share a quote soon.' },
  [ServiceRequestStatus.QUOTATION_SHARED]: { sms: true, push: true, template: 'Your repair quote is ready! Ticket: {ticket}. Please review and approve in the app.' },
  [ServiceRequestStatus.PAYMENT_RECEIVED]: { sms: true, push: true, template: 'Payment received for ticket {ticket}. Your device is now under repair.' },
  [ServiceRequestStatus.REPAIR_COMPLETE]: { sms: false, push: true, template: 'Your device repair is complete! Ticket: {ticket}. Preparing for delivery.' },
  [ServiceRequestStatus.OUT_FOR_DELIVERY]: { sms: true, push: true, template: 'Your device is out for delivery. Ticket: {ticket}. Our agent will arrive at your address soon.' },
  [ServiceRequestStatus.DELIVERED]: { sms: true, push: true, template: 'Your device has been delivered successfully. Ticket: {ticket}. Thank you for choosing VfixurPC!' },
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification) private notifRepo: Repository<Notification>,
    private config: ConfigService,
  ) {
    // Initialize Firebase only if a real service account is provided
    if (!admin.apps.length) {
      const serviceAccount = this.config.get('FIREBASE_SERVICE_ACCOUNT');
      try {
        const parsed = JSON.parse(serviceAccount || '{}');
        if (parsed.project_id) {
          admin.initializeApp({
            credential: admin.credential.cert(parsed),
          });
        }
      } catch {
        // Firebase not configured — push notifications disabled
      }
    }
  }

  async triggerStatusNotification(
    status: ServiceRequestStatus,
    user: User,
    serviceRequestId: string,
    ticketNumber: string,
    date?: string,
  ) {
    const cfg = STATUS_MESSAGES[status];
    if (!cfg) return;

    const message = cfg.template
      .replace('{ticket}', ticketNumber)
      .replace('{date}', date ?? '');

    const promises: Promise<void>[] = [];

    if (cfg.sms) promises.push(this.sendSms(user, message, serviceRequestId));
    if (cfg.push && user.fcmToken) promises.push(this.sendPush(user, message, serviceRequestId, ticketNumber));

    await Promise.allSettled(promises);
  }

  private async sendSms(user: User, message: string, serviceRequestId: string) {
    const notif = await this.notifRepo.save(
      this.notifRepo.create({
        userId: user.id,
        serviceRequestId,
        type: NotificationType.SMS,
        message,
        status: NotificationStatus.PENDING,
      }),
    );

    try {
      // MSG91 API
      await axios.post(
        'https://api.msg91.com/api/v5/flow/',
        {
          template_id: this.config.get('MSG91_TEMPLATE_ID'),
          short_url: '0',
          mobiles: `91${user.phone.replace('+91', '')}`,
          VAR1: message,
        },
        {
          headers: {
            authkey: this.config.get('MSG91_AUTH_KEY'),
            'Content-Type': 'application/json',
          },
        },
      );
      await this.notifRepo.update(notif.id, { status: NotificationStatus.SENT });
    } catch (err) {
      this.logger.error(`SMS failed for user ${user.id}: ${err.message}`);
      await this.notifRepo.update(notif.id, { status: NotificationStatus.FAILED });
    }
  }

  private async sendPush(user: User, message: string, serviceRequestId: string, ticketNumber: string) {
    const notif = await this.notifRepo.save(
      this.notifRepo.create({
        userId: user.id,
        serviceRequestId,
        type: NotificationType.PUSH,
        message,
        status: NotificationStatus.PENDING,
      }),
    );

    try {
      await admin.messaging().send({
        token: user.fcmToken,
        notification: {
          title: `VfixurPC — ${ticketNumber}`,
          body: message,
        },
        data: { serviceRequestId, ticketNumber },
      });
      await this.notifRepo.update(notif.id, { status: NotificationStatus.SENT });
    } catch (err) {
      this.logger.error(`Push failed for user ${user.id}: ${err.message}`);
      await this.notifRepo.update(notif.id, { status: NotificationStatus.FAILED });
    }
  }

  async findByUser(userId: string) {
    return this.notifRepo.find({
      where: { userId },
      order: { sentAt: 'DESC' },
      take: 50,
    });
  }
}
