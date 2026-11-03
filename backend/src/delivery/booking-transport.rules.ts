import { ServiceRequestStatus as Status } from '../common/enums';
import { BookingTransportTask } from './entities/booking-transport-task.entity';
import { ServiceRequest } from '../service-requests/entities/service-request.entity';

export function sameRequestIds(a: string[], b: string[]) {
  return a.length > 0 && new Set(a).size === a.length && new Set(b).size === b.length &&
    a.length === b.length && [...a].sort().every((id, index) => id === [...b].sort()[index]);
}

export function transportBlockers(plan: BookingTransportTask, requests: ServiceRequest[]): string[] {
  if (!sameRequestIds(plan.requestIds, requests.map(request => request.id))) {
    return ['Booking device membership has changed. Cancel this task and review the booking.'];
  }
  return requests.flatMap(request => {
    const ticket = request.serviceRequestNumber || request.id;
    if (request.bookingId !== plan.bookingId || request.serviceMode !== 'PICKUP') return [ticket + ': not a pickup request in this booking'];
    if (plan.direction === 'RETURN' && request.handoverMethod === 'CUSTOMER_COLLECTION') return [ticket + ': customer collection selected'];
    const allowed = plan.direction === 'PICKUP'
      ? [Status.REQUEST_RECEIVED, Status.PICKUP_SCHEDULED]
      : [Status.READY_FOR_HANDOVER, Status.OUT_FOR_DELIVERY];
    return allowed.includes(request.status) ? [] : [ticket + ': ' + request.status.toLowerCase().replace(/_/g, ' ')];
  });
}
