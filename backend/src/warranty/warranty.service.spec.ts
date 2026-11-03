import { WarrantyService } from './warranty.service';
import { RepairWarranty, WarrantyClaim } from './warranty.entities';
import { ServiceRequest } from '../service-requests/entities/service-request.entity';
import { Role, ServiceRequestStatus } from '../common/enums';

describe('Repair warranty', () => {
  let service: WarrantyService, em: any, sr: any, coverage: any, claims: any[], notices: any;
  const customer: any = { id: 'customer', role: Role.CUSTOMER };
  const admin: any = { id: 'admin', role: Role.SUPER_ADMIN };
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-09T12:00:00Z'));
    sr = { id: 'ticket', customerId: customer.id, customer, status: ServiceRequestStatus.DELIVERED, quoteApproved: true, serviceRequestNumber: 'VFX-TEST' };
    coverage = { serviceRequestId: sr.id, startsOn: '2026-09-01', endsOn: '2026-12-01', coverage: 'Original repair only' };
    claims = [];
    em = { findOne: jest.fn(async (entity, options) => entity === ServiceRequest ? sr : entity === RepairWarranty ? coverage : claims.find(c => c.id === options.where.id && c.serviceRequestId === options.where.serviceRequestId)),
      find: jest.fn(async () => claims), create: jest.fn((entity, value) => value), save: jest.fn(async (...args) => args[args.length - 1]) };
    notices = { notify: jest.fn(async () => {}), notifyAdmins: jest.fn(async () => {}) };
    service = new WarrantyService({ manager: em, transaction: async (fn: any) => fn(em) } as any, notices);
  });
  afterEach(() => jest.useRealTimers());
  it('rejects another customer reading or claiming the ticket', async () => {
    const other = { ...customer, id: 'other' };
    await expect(service.get('ticket', other)).rejects.toThrow();
    await expect(service.request('ticket', { description: 'The same issue returned' }, other)).rejects.toThrow();
    expect(em.save).not.toHaveBeenCalled();
  });
  it('allows an in-window claim on the same ticket with immutable coverage snapshot and notifications', async () => {
    await service.request('ticket', { description: 'The same issue returned' }, customer);
    expect(em.save).toHaveBeenCalledWith(expect.objectContaining({ serviceRequestId: 'ticket', status: 'REQUESTED', coverageSnapshot: { startsOn: coverage.startsOn, endsOn: coverage.endsOn, coverage: coverage.coverage } }));
    expect(em.findOne).toHaveBeenCalledWith(ServiceRequest, expect.objectContaining({ lock: { mode: 'pessimistic_write' } }));
    expect(notices.notifyAdmins).toHaveBeenCalledTimes(1);
    expect(notices.notify).toHaveBeenCalledTimes(1);
  });
  it.each(['2026-08-01', '2026-09-08'])('rejects expired coverage ending %s', async end => {
    coverage.endsOn = end;
    await expect(service.request('ticket', { description: 'Issue returned' }, customer)).rejects.toThrow('No active warranty');
  });
  it('covers the entire end date in India and expires at India midnight', async () => {
    coverage.endsOn = '2026-09-09';
    jest.setSystemTime(new Date('2026-09-09T18:29:59Z'));
    expect((await service.get('ticket', customer)).canClaim).toBe(true);
    jest.setSystemTime(new Date('2026-09-09T18:30:00Z'));
    expect((await service.get('ticket', customer)).canClaim).toBe(false);
  });
  it('rejects duplicate open follow-ups without sending notifications', async () => {
    claims.push({ status: 'IN_PROGRESS' });
    await expect(service.request('ticket', { description: 'Issue returned' }, customer)).rejects.toThrow('already open');
    expect(notices.notify).not.toHaveBeenCalled();
  });
  it('rejects claims before handover or before coverage starts', async () => {
    sr.status = ServiceRequestStatus.REPAIR_COMPLETE;
    await expect(service.request('ticket', { description: 'Issue returned' }, customer)).rejects.toThrow('No active warranty');
    sr.status = ServiceRequestStatus.DELIVERED; coverage.startsOn = '2026-10-01';
    await expect(service.request('ticket', { description: 'Issue returned' }, customer)).rejects.toThrow('No active warranty');
  });
  it('rejects customer and technician policy edits', async () => {
    await expect(service.set('ticket', coverage, customer)).rejects.toThrow();
    await expect(service.set('ticket', coverage, { ...admin, role: Role.TECHNICIAN })).rejects.toThrow();
  });
  it('rejects invalid dates and shortening or rewriting an issued warranty', async () => {
    await expect(service.set('ticket', { ...coverage, startsOn: '2026-02-31' }, admin)).rejects.toThrow('valid');
    await expect(service.set('ticket', { ...coverage, endsOn: '2026-10-01' }, admin)).rejects.toThrow('shortened');
    await expect(service.set('ticket', { ...coverage, coverage: 'Less coverage' }, admin)).rejects.toThrow('cannot be changed');
  });
  it('allows admin to issue or extend a repair warranty', async () => {
    await service.set('ticket', { ...coverage, endsOn: '2026-12-31' }, admin);
    expect(em.save).toHaveBeenCalledWith(RepairWarranty, expect.objectContaining({ endsOn: '2026-12-31', updatedBy: admin.id }));
  });
  it('requires a completed approved repair for policy issuance', async () => {
    sr.quoteApproved = false;
    await expect(service.set('ticket', coverage, admin)).rejects.toThrow('approved repair');
  });
  it('reviews the claim without reopening the original quote or modifying coverage', async () => {
    claims.push({ id: 'claim', serviceRequestId: 'ticket', status: 'REQUESTED', history: [] });
    await service.review('ticket', 'claim', { status: 'IN_PROGRESS', note: 'Accepted. We will arrange collection.' }, admin);
    expect(claims[0].status).toBe('IN_PROGRESS');
    expect(claims[0].history[0].actorId).toBe(admin.id);
    expect(sr.status).toBe(ServiceRequestStatus.DELIVERED);
    expect(notices.notify).toHaveBeenCalledTimes(1);
    await expect(service.review('ticket', 'claim', { status: 'DECLINED', note: 'Cannot do this' }, admin)).rejects.toThrow('changed');
  });
  it('rejects claim ids belonging to another ticket and customer reviews', async () => {
    claims.push({ id: 'claim', serviceRequestId: 'other', status: 'REQUESTED' });
    await expect(service.review('ticket', 'claim', { status: 'DECLINED', note: 'Outside scope' }, admin)).rejects.toThrow('not found');
    await expect(service.review('ticket', 'claim', { status: 'DECLINED', note: 'Outside scope' }, customer)).rejects.toThrow();
  });
});
