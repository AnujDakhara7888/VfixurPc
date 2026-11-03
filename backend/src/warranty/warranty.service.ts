import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ServiceRequest } from '../service-requests/entities/service-request.entity';
import { User } from '../users/user.entity';
import { Role, ServiceRequestStatus } from '../common/enums';
import { NotificationsService } from '../notifications/notifications.service';
import { RepairWarranty, WarrantyClaim, ClaimStatus } from './warranty.entities';
import { SetWarrantyDto, RequestWarrantyDto, ReviewWarrantyDto } from './warranty.dto';

const OPEN: ClaimStatus[] = ['REQUESTED', 'IN_PROGRESS'];
const REVIEW: Record<ClaimStatus, ClaimStatus[]> = { REQUESTED: ['IN_PROGRESS', 'DECLINED'], IN_PROGRESS: ['RESOLVED'], DECLINED: [], RESOLVED: [] };
const LABEL: Record<ClaimStatus, string> = { REQUESTED: 'Requested', IN_PROGRESS: 'In progress', DECLINED: 'Declined', RESOLVED: 'Resolved' };
export function indiaToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function validDate(value: string) {
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

@Injectable()
export class WarrantyService {
  constructor(private db: DataSource, private notifications: NotificationsService) {}
  private admin(user: User) {
    if (![Role.SUPER_ADMIN, Role.OPERATIONS].includes(user.role)) throw new ForbiddenException();
  }
  private async ticket(em: EntityManager, id: string, user: User, lock = false) {
    const sr = await em.findOne(ServiceRequest, { where: { id }, ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}) });
    if (!sr) throw new NotFoundException('Service request not found');
    if (user.role === Role.CUSTOMER && sr.customerId !== user.id) throw new ForbiddenException();
    return sr;
  }
  async get(id: string, user: User) {
    const sr = await this.ticket(this.db.manager, id, user);
    const coverage = await this.db.manager.findOne(RepairWarranty, { where: { serviceRequestId: id } });
    const claims = await this.db.manager.find(WarrantyClaim, { where: { serviceRequestId: id }, order: { createdAt: 'DESC' } });
    const today = indiaToday();
    const active = !!coverage && coverage.startsOn <= today && today <= coverage.endsOn;
    return { coverage, claims, active, canClaim: active && sr.status === ServiceRequestStatus.DELIVERED && !claims.some(c => OPEN.includes(c.status)) };
  }
  async set(id: string, dto: SetWarrantyDto, user: User) {
    this.admin(user);
    if (!validDate(dto.startsOn) || !validDate(dto.endsOn) || dto.endsOn < dto.startsOn) throw new BadRequestException('Choose valid warranty start and end dates');
    await this.db.transaction(async em => {
      const sr = await this.ticket(em, id, user, true);
      if (!sr.quoteApproved || ![ServiceRequestStatus.REPAIR_COMPLETE, ServiceRequestStatus.READY_FOR_HANDOVER, ServiceRequestStatus.OUT_FOR_DELIVERY, ServiceRequestStatus.DELIVERED].includes(sr.status)) throw new BadRequestException('Set warranty after an approved repair is complete');
      const existing = await em.findOne(RepairWarranty, { where: { serviceRequestId: id } });
      if (existing && dto.endsOn < existing.endsOn) throw new BadRequestException('An issued warranty cannot be shortened');
      if (existing && (dto.startsOn !== existing.startsOn || dto.coverage !== existing.coverage)) throw new BadRequestException('Issued warranty coverage and start date cannot be changed. You can extend its end date.');
      await em.save(RepairWarranty, { serviceRequestId: id, ...dto, updatedBy: user.id });
    });
    await this.customerUpdate(id, 'Warranty details have been updated. Open your repair ticket to view the coverage and dates.');
    return this.get(id, user);
  }
  async request(id: string, dto: RequestWarrantyDto, user: User) {
    if (user.role !== Role.CUSTOMER) throw new ForbiddenException();
    await this.db.transaction(async em => {
      // The ticket lock serializes claims, coverage edits and handover updates.
      const sr = await this.ticket(em, id, user, true);
      const coverage = await em.findOne(RepairWarranty, { where: { serviceRequestId: id } });
      const today = indiaToday();
      if (sr.status !== ServiceRequestStatus.DELIVERED || !coverage || coverage.startsOn > today || coverage.endsOn < today) throw new BadRequestException('No active warranty on this completed repair. Contact VfixurPC for help.');
      const claims = await em.find(WarrantyClaim, { where: { serviceRequestId: id } });
      if (claims.some(c => OPEN.includes(c.status))) throw new BadRequestException('A warranty follow-up is already open on this ticket');
      await em.save(em.create(WarrantyClaim, { serviceRequestId: id, description: dto.description, status: 'REQUESTED',
        coverageSnapshot: { startsOn: coverage.startsOn, endsOn: coverage.endsOn, coverage: coverage.coverage },
        history: [{ status: 'REQUESTED', note: 'Warranty follow-up requested', actorId: user.id, at: new Date().toISOString() }] }));
    });
    const sr = await this.ticket(this.db.manager, id, user);
    await this.notifications.notifyAdmins('Warranty follow-up requested: ' + sr.serviceRequestNumber + '.', id).catch(() => {});
    await this.customerUpdate(id, 'Your warranty follow-up has been received. VfixurPC will review it and contact you.');
    return this.get(id, user);
  }
  async review(id: string, claimId: string, dto: ReviewWarrantyDto, user: User) {
    this.admin(user);
    await this.db.transaction(async em => {
      await this.ticket(em, id, user, true);
      const claim = await em.findOne(WarrantyClaim, { where: { id: claimId, serviceRequestId: id } });
      if (!claim) throw new NotFoundException('Warranty follow-up not found');
      if (!REVIEW[claim.status].includes(dto.status)) throw new BadRequestException('This warranty follow-up has changed. Refresh and try again.');
      claim.status = dto.status;
      claim.history = [...claim.history, { status: dto.status, note: dto.note, actorId: user.id, at: new Date().toISOString() }];
      await em.save(claim);
    });
    await this.customerUpdate(id, 'Warranty follow-up: ' + LABEL[dto.status] + '. Open your repair ticket for the update.');
    return this.get(id, user);
  }
  private async customerUpdate(id: string, message: string) {
    const sr = await this.db.manager.findOne(ServiceRequest, { where: { id }, relations: { customer: true } });
    if (sr?.customer) await this.notifications.notify(sr.customer, message, id).catch(() => {});
  }
}
