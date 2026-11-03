import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { WebPushSubscription } from './web-push.entity';

export function validateSubscription(endpoint: string, keys: { p256dh: string; auth: string }) {
  let url: URL;
  try { url = new URL(endpoint); } catch { throw new BadRequestException('Invalid push endpoint'); }
  // Only known push providers can be contacted; never accept arbitrary server URLs.
  const allowed = url.hostname === 'fcm.googleapis.com' || url.hostname === 'updates.push.services.mozilla.com'
    || url.hostname === 'web.push.apple.com' || url.hostname.endsWith('.notify.windows.com');
  if (!allowed || url.protocol !== 'https:' || url.port || url.username || url.password || url.hash)
    throw new BadRequestException('Unsupported push provider');
  if (!keys || !/^[\w-]+={0,2}$/.test(keys.p256dh) || !/^[\w-]+={0,2}$/.test(keys.auth)
    || Buffer.from(keys.p256dh, 'base64url').length !== 65 || Buffer.from(keys.auth, 'base64url').length !== 16)
    throw new BadRequestException('Invalid push subscription keys');
}

@Injectable()
export class WebPushService {
  private readonly logger = new Logger(WebPushService.name);
  constructor(@InjectRepository(WebPushSubscription) private repo: Repository<WebPushSubscription>, private config: ConfigService) {}
  settings() {
    const publicKey = this.config.get<string>('WEB_PUSH_PUBLIC_KEY');
    return { enabled: !!(publicKey && this.config.get('WEB_PUSH_PRIVATE_KEY') && this.config.get('WEB_PUSH_SUBJECT')), publicKey };
  }
  async subscribe(userId: string, endpoint: string, keys: { p256dh: string; auth: string }) {
    if (!this.settings().enabled) throw new ServiceUnavailableException('Browser notifications are not configured');
    validateSubscription(endpoint, keys);
    await this.repo.upsert({ userId, endpoint, keys }, ['endpoint']);
    return { subscribed: true };
  }
  async unsubscribe(userId: string, endpoint: string) {
    await this.repo.delete({ userId, endpoint });
    return { subscribed: false };
  }
  async removeForUser(userId: string) { await this.repo.delete({ userId }); }
  async send(userId: string, notificationId: string, serviceRequestId?: string) {
    if (!this.settings().enabled) return { accepted: 0 };
    const rows = await this.repo.find({ where: { userId } });
    let accepted = 0;
    await Promise.allSettled(rows.map(async row => {
      try {
        validateSubscription(row.endpoint, row.keys);
        await webpush.sendNotification({ endpoint: row.endpoint, keys: row.keys }, JSON.stringify({
          title: 'VfixurPC customer update',
          // Keep customer details off the lock screen; the authenticated inbox has the full event.
          body: 'New activity needs your attention. Open your admin inbox.',
          notificationId,
          url: serviceRequestId ? '/dashboard/service-requests/' + serviceRequestId : '/dashboard',
        }), {
          TTL: 3600, urgency: 'high', timeout: 3000,
          vapidDetails: { subject: this.config.get<string>('WEB_PUSH_SUBJECT')!, publicKey: this.settings().publicKey!, privateKey: this.config.get<string>('WEB_PUSH_PRIVATE_KEY')! },
        });
        accepted += 1;
      } catch (error) {
        if ([404, 410].includes(error.statusCode)) await this.repo.delete(row.id);
        else this.logger.warn('Browser push failed; inbox event retained');
      }
    }));
    return { accepted };
  }
}
