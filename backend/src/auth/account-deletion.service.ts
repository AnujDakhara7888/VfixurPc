import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { Role } from '../common/enums';

@Injectable()
export class AccountDeletionService {
  constructor(private db: DataSource) {}

  async delete(userId: string, password: string) {
    return this.db.transaction(async em => {
      const [user] = await em.query('SELECT id, role, password_hash, is_active FROM users WHERE id = $1 FOR UPDATE', [userId]);
      if (!user?.is_active) throw new UnauthorizedException('Sign in again to delete your account');
      if (user.role !== Role.CUSTOMER) throw new ForbiddenException('Staff account deletion must be managed by the account owner');
      // Failed reauthentication is not an expired bearer token: 401 triggers client refresh.
      if (!await bcrypt.compare(password, user.password_hash)) throw new BadRequestException('Incorrect password');
      const replacementHash = await bcrypt.hash(randomUUID(), 12);
      // Pseudonymisation, not erasure: retained records can still identify this UUID.
      await em.query(`UPDATE users SET name = 'Deleted customer', email = $2, username = $3,
        phone = $3, password_hash = $4, is_active = false, refresh_token = NULL,
        fcm_token = NULL, token_version = token_version + 1, updated_at = now() WHERE id = $1`,
        [userId, 'deleted-' + userId + '@invalid.example', 'deleted-' + userId, replacementHash]);
      await em.query('DELETE FROM password_resets WHERE user_id = $1', [userId]);
      await em.query('DELETE FROM web_push_subscriptions WHERE user_id = $1', [userId]);
      await em.query(`DELETE FROM notifications WHERE user_id = $1 OR service_request_id IN
        (SELECT id FROM service_requests WHERE customer_id = $1)`, [userId]);
      await em.query(`DELETE FROM ticket_attachments WHERE service_request_id IN
        (SELECT id FROM service_requests WHERE customer_id = $1)`, [userId]);
      await em.query(`UPDATE devices SET brand = 'Removed', model = 'Removed', serial_number = NULL,
        condition = NULL, specs = NULL WHERE customer_id = $1`, [userId]);
      await em.query(`UPDATE issue_selections SET description = NULL WHERE service_request_id IN
        (SELECT id FROM service_requests WHERE customer_id = $1)`, [userId]);
      await em.query(`UPDATE status_history SET notes = NULL WHERE service_request_id IN
        (SELECT id FROM service_requests WHERE customer_id = $1)`, [userId]);
      await em.query(`UPDATE service_requests SET pickup_address = 'Removed after account deletion',
        booking_answers = '{}', notes = NULL, scratches = NULL, dents = NULL,
        hinge_condition = NULL, screen_condition = NULL, quote_rejected_reason = NULL
        WHERE customer_id = $1`, [userId]);
      // Retention audit / release blockers (not legally required indefinite retention):
      // - Preserve invoices (buyer/contact/address snapshots and PDF bytes/URLs), payments,
      //   quote_items, quote_archive, repair_warranties and warranty_claims unchanged.
      //   Descriptions/history may contain PII; linked tickets, consent and schedules remain.
      // - condition_photos is retained warranty/dispute condition evidence (Terms 2.4),
      //   including DB bytes and local/S3 copies, not a blanket exception for uploads.
      //   General ticket_attachments are deleted above. Evidence needs purpose review
      //   and durable external cleanup when that purpose ends (Privacy 1.11-1.12).
      // - Unlinked staff notifications (registration names), delivered email/push,
      //   provider logs, exports and backups cannot be erased by this transaction.
      // - Owners must define retention periods, holds, restricted access and purge jobs,
      //   and prevent concurrent writers from repopulating personal data after deletion.
      return { message: 'Your account access has been removed and your profile anonymised. General request uploads are deleted. Invoice, tax, quote and warranty records, including condition evidence needed for warranty or disputes, remain separate. Previously sent messages and backup copies are not erased by this action. Contact support to request review of retained data.' };
    });
  }
}
