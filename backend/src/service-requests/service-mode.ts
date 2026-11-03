import { BadRequestException } from '@nestjs/common';
import { assertInServiceArea } from './service-area';

export const WORKSHOP_ADDRESS = '3rd floor, 99 Ratnajyot industrial premises, Irla Lane, Near Ambe Mata Chawk, Vile Parle West, Mumbai 400056';
export function serviceAddress(mode: string, address?: string) {
  if (mode === 'CARRY_IN') return WORKSHOP_ADDRESS;
  if (mode === 'CONSULTATION') return 'Consultation by phone';
  if (mode === 'REMOTE') return 'Remote support';
  if (!address?.trim()) throw new BadRequestException('Enter the service address');
  if (mode === 'PICKUP') assertInServiceArea(address);
  return address.trim();
}
export function assertModeStatus(mode = 'PICKUP', status: string) {
  if (mode !== 'PICKUP' && ['PICKUP_SCHEDULED', 'PICKED_UP', 'OUT_FOR_DELIVERY'].includes(status)) {
    throw new BadRequestException('Pickup and delivery stages are only available for Pickup & delivery requests');
  }
  if (['ON_SITE', 'REMOTE', 'CONSULTATION'].includes(mode) && status === 'RECEIVED_AT_WORKSHOP') {
    throw new BadRequestException('This request does not require workshop handover');
  }
}
