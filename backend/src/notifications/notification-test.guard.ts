import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
@Injectable()
export class NotificationTestGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>) { return req.user.id; }
}
