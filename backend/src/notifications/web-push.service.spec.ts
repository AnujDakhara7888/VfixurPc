import { BadRequestException } from '@nestjs/common';
import * as webpush from 'web-push';
import { validateSubscription, WebPushService } from './web-push.service';
jest.mock('web-push', () => ({ sendNotification: jest.fn() }));
const keys = { p256dh: Buffer.alloc(65, 4).toString('base64url'), auth: Buffer.alloc(16, 1).toString('base64url') };
describe('Admin web push', () => {
  const repo: any = { upsert: jest.fn(), delete: jest.fn(), find: jest.fn() };
  const config: any = { get: (key: string) => ({ WEB_PUSH_PUBLIC_KEY: 'public', WEB_PUSH_PRIVATE_KEY: 'private', WEB_PUSH_SUBJECT: 'mailto:hriday@vfixurpc.com' })[key] };
  beforeEach(() => jest.resetAllMocks());
  it.each(['https://localhost/push', 'https://169.254.169.254/metadata', 'https://fcm.googleapis.com.evil.test/x', 'https://user:pass@web.push.apple.com/x', 'http://web.push.apple.com/x', 'https://web.push.apple.com:8080/x'])('rejects unsafe endpoint %s', endpoint => {
    expect(() => validateSubscription(endpoint, keys)).toThrow(BadRequestException);
  });
  it.each(['https://web.push.apple.com/Q123', 'https://fcm.googleapis.com/fcm/send/123', 'https://updates.push.services.mozilla.com/wpush/v2/123'])('accepts supported provider %s', endpoint => {
    expect(() => validateSubscription(endpoint, keys)).not.toThrow();
  });
  it('validates key lengths', () => expect(() => validateSubscription('https://web.push.apple.com/x', { ...keys, auth: 'short' })).toThrow());
  it('scopes unsubscribe to the authenticated owner', async () => {
    await new WebPushService(repo, config).unsubscribe('owner', 'endpoint');
    expect(repo.delete).toHaveBeenCalledWith({ userId: 'owner', endpoint: 'endpoint' });
  });
  it('removes expired subscriptions, retaining active ones', async () => {
    repo.find.mockResolvedValue([{ id: 'expired', endpoint: 'https://web.push.apple.com/x', keys }]);
    (webpush.sendNotification as jest.Mock).mockRejectedValue({ statusCode: 410 });
    await new WebPushService(repo, config).send('owner', 'event', 'ticket');
    expect(repo.delete).toHaveBeenCalledWith('expired');
  });
  it('sends only generic lock-screen content with an authenticated destination', async () => {
    repo.find.mockResolvedValue([{ id: 'active', endpoint: 'https://web.push.apple.com/x', keys }]);
    (webpush.sendNotification as jest.Mock).mockResolvedValue({ statusCode: 201 });
    await new WebPushService(repo, config).send('owner', 'event', 'ticket');
    expect(repo.find).toHaveBeenCalledWith({ where: { userId: 'owner' } });
    expect(JSON.parse((webpush.sendNotification as jest.Mock).mock.calls[0][1])).toEqual(expect.objectContaining({ notificationId: 'event', url: '/dashboard/service-requests/ticket' }));
  });
});
