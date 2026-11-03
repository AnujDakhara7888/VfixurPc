import { DeliveryService } from './delivery.service';
import { AssignmentStatus, AssignmentType, PhotoType, Role, ServiceRequestStatus } from '../common/enums';

jest.mock('uuid', () => ({ v4: () => 'photo-id' }));

function setup(mode = 'PICKUP') {
  const request = { id: 'request', bookingId: 'booking', serviceMode: mode, status: ServiceRequestStatus.PICKUP_SCHEDULED };
  const assignment = { id: 'assignment', serviceRequestId: request.id, agentId: 'agent', serviceRequest: request, type: AssignmentType.PICKUP, status: AssignmentStatus.PENDING };
  const assignments: any = { findOne: jest.fn(async () => assignment), create: jest.fn(v => v), save: jest.fn(async v => v), find: jest.fn(async () => [assignment]) };
  const photos: any = { count: jest.fn(async () => 1), save: jest.fn() };
  const requests: any = { findOne: jest.fn(async () => request), update: jest.fn() };
  const history: any = { create: jest.fn(v => v), save: jest.fn() };
  const attachments: any = { save: jest.fn() };
  const notifications: any = { triggerStatusNotification: jest.fn(async () => {}) };
  const service = new DeliveryService(assignments, photos, requests, history, { get: () => '' } as any, attachments, notifications);
  const agent: any = { id: 'agent', role: Role.DELIVERY_AGENT };
  return { service, request, assignment, assignments, requests, photos, history, attachments, agent };
}

describe('Delivery mode boundaries', () => {
  it.each(['CARRY_IN', 'ON_SITE', 'CONSULTATION', 'REMOTE'])('blocks all mutations for %s, including old assignments', async mode => {
    const s = setup(mode);
    await expect(s.service.createAssignment({ serviceRequestId: 'request' } as any)).rejects.toThrow('service option');
    await expect(s.service.uploadConditionPhoto('assignment', {} as any, PhotoType.WAREHOUSE, s.agent)).rejects.toThrow('service option');
    await expect(s.service.completeAssignment('assignment', s.agent)).rejects.toThrow('service option');
    await expect(s.service.verifyOtp('assignment', '123456', s.agent)).rejects.toThrow('service option');
    await expect((s.service as any).advanceStatus('request', ServiceRequestStatus.RECEIVED_AT_WORKSHOP, 'received')).rejects.toThrow('service option');
    expect(await s.service.findAgentTasks('agent')).toEqual([]);
    for (const repo of [s.assignments, s.photos, s.history, s.attachments]) expect(repo.save).not.toHaveBeenCalled();
    expect(s.requests.update).not.toHaveBeenCalled();
  });
  it('still permits proof-gated pickup completion and does not repeat it', async () => {
    const s = setup();
    await s.service.completeAssignment('assignment', s.agent);
    expect(s.requests.update).toHaveBeenCalledWith('request', { status: ServiceRequestStatus.PICKED_UP });
    await s.service.completeAssignment('assignment', s.agent);
    expect(s.assignments.save).toHaveBeenCalledTimes(1);
  });
  it('rejects missing requests before saving any proof', async () => {
    const s = setup();
    s.requests.findOne.mockResolvedValue(null);
    await expect(s.service.uploadConditionPhoto('assignment', {} as any, PhotoType.WAREHOUSE, s.agent)).rejects.toThrow('not found');
    expect(s.photos.save).not.toHaveBeenCalled();
  });
  it('does not deliver a cancelled or unfinished request', async () => {
    const s = setup();
    s.assignment.type = AssignmentType.DELIVERY;
    for (const status of [ServiceRequestStatus.CANCELLED, ServiceRequestStatus.UNDER_REPAIR]) {
      s.request.status = status;
      await expect(s.service.completeAssignment('assignment', s.agent)).rejects.toThrow('not ready');
    }
    expect(s.assignments.save).not.toHaveBeenCalled();
    expect(s.requests.update).not.toHaveBeenCalled();
  });
});

describe('Atomic booking transport plans', () => {
  function booking(modes = ['PICKUP', 'PICKUP']) {
    const s = setup();
    const requests = modes.map((serviceMode, index) => ({ id: 'request-' + index, bookingId: 'booking', serviceMode }));
    let plans: any[] = [];
    let pending: any[] = [];
    const query: any = { insert: () => query, values: values => { pending = values; return query; }, orIgnore: () => query,
      execute: jest.fn(async () => { if (!plans.length) plans = pending; }) };
    const repo: any = { createQueryBuilder: () => query, find: jest.fn(async () => plans) };
    const em: any = { queryRunner: { isTransactionActive: true }, find: jest.fn(async () => requests), getRepository: () => repo };
    return { ...s, em, requests, query, ids: requests.map(r => r.id) };
  }
  it('plans exactly two directions for a multi-device booking, including retries', async () => {
    const s = booking();
    const plans = await s.service.planBooking(s.em, 'booking', s.ids);
    expect(plans.map(p => p.direction)).toEqual(['PICKUP', 'RETURN']);
    expect(plans.every(p => p.requestIds.length === 2 && p.status === 'PLANNED')).toBe(true);
    expect(await s.service.planBooking(s.em, 'booking', [...s.ids, s.ids[0]])).toEqual(plans);
    expect(s.assignments.save).not.toHaveBeenCalled();
  });
  it.each(['CARRY_IN', 'ON_SITE', 'CONSULTATION', 'REMOTE'])('creates no plans for %s', async mode => {
    const s = booking([mode]);
    expect(await s.service.planBooking(s.em, 'booking', s.ids)).toEqual([]);
    expect(s.query.execute).not.toHaveBeenCalled();
  });
  it('rejects mixed fulfilment, mismatched bookings and nontransactional calls', async () => {
    const s = booking(['PICKUP', 'CARRY_IN']);
    await expect(s.service.planBooking(s.em, 'booking', s.ids)).rejects.toThrow('mix');
    await expect(s.service.planBooking(s.em, 'other', s.ids)).rejects.toThrow('belong');
    s.em.queryRunner.isTransactionActive = false;
    await expect(s.service.planBooking(s.em, 'booking', s.ids)).rejects.toThrow('transaction');
    expect(s.query.execute).not.toHaveBeenCalled();
  });
});
