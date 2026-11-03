import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDateOnly, formatDateTime } from './dateTime';
import type { ServiceRequestStatus } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string) {
  return formatDateTime(iso);
}

export function formatDateShort(iso: string) {
  return formatDateOnly(iso);
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
}

export const STATUS_COLORS: Record<ServiceRequestStatus, string> = {
  REQUEST_RECEIVED: 'bg-gray-100 text-gray-700',
  DIAGNOSING: 'bg-gray-100 text-gray-700',
  QUOTE_APPROVED: 'bg-green-100 text-green-800',
  QUOTE_REJECTED: 'bg-gray-100 text-gray-700',
  AWAITING_PARTS: 'bg-gray-100 text-gray-700',
  TESTING: 'bg-gray-100 text-gray-700',
  READY_FOR_HANDOVER: 'bg-gray-100 text-gray-700',
  CANCELLED: 'bg-gray-100 text-gray-700',
  PICKUP_SCHEDULED:     'bg-blue-100 text-blue-700',
  PICKED_UP:            'bg-indigo-100 text-indigo-700',
  RECEIVED_AT_WORKSHOP: 'bg-purple-100 text-purple-700',
  DIAGNOSED:            'bg-yellow-100 text-yellow-700',
  QUOTATION_SHARED:     'bg-red-100 text-red-700',
  PAYMENT_RECEIVED:     'bg-lime-100 text-lime-700',
  UNDER_REPAIR:         'bg-cyan-100 text-cyan-700',
  REPAIR_COMPLETE:      'bg-teal-100 text-teal-700',
  OUT_FOR_DELIVERY:     'bg-sky-100 text-sky-700',
  DELIVERED:            'bg-green-100 text-green-700',
};

export const STATUS_LABELS: Record<ServiceRequestStatus, string> = {
 REQUEST_RECEIVED: 'Request received',
 DIAGNOSING: 'Diagnosis in progress',
 QUOTE_APPROVED: 'Quote approved',
 QUOTE_REJECTED: 'Return requested',
 AWAITING_PARTS: 'Awaiting parts',
 TESTING: 'Testing',
 READY_FOR_HANDOVER: 'Ready for handover',
 CANCELLED: 'Cancelled',
  PICKUP_SCHEDULED:     'Pickup Scheduled',
  PICKED_UP:            'Picked Up',
  RECEIVED_AT_WORKSHOP: 'At Workshop',
  DIAGNOSED:            'Diagnosed',
  QUOTATION_SHARED:     'Quote Shared',
  PAYMENT_RECEIVED:     'Payment Received',
  UNDER_REPAIR:         'Under Repair',
  REPAIR_COMPLETE:      'Repair Complete',
  OUT_FOR_DELIVERY:     'Out for Delivery',
  DELIVERED:            'Delivered',
};

// Valid transitions (mirrors backend STATUS_TRANSITIONS)
export const NEXT_STATUSES: Partial<Record<ServiceRequestStatus, ServiceRequestStatus[]>> = {
 REQUEST_RECEIVED: ["PICKUP_SCHEDULED","RECEIVED_AT_WORKSHOP","DIAGNOSING","CANCELLED"],
 DIAGNOSING: ["DIAGNOSED"],
 QUOTE_APPROVED: ["AWAITING_PARTS","UNDER_REPAIR"],
 QUOTE_REJECTED: ["READY_FOR_HANDOVER"],
 AWAITING_PARTS: ["UNDER_REPAIR"],
 TESTING: ["REPAIR_COMPLETE","UNDER_REPAIR"],
 READY_FOR_HANDOVER: ["OUT_FOR_DELIVERY","DELIVERED"],
 CANCELLED: [],
  PICKUP_SCHEDULED:     ['PICKED_UP', 'DIAGNOSING', 'CANCELLED'],
  PICKED_UP:            ['RECEIVED_AT_WORKSHOP'],
  RECEIVED_AT_WORKSHOP: ['DIAGNOSING', 'DIAGNOSED'],
  DIAGNOSED:            [],
  QUOTATION_SHARED:     [],
  PAYMENT_RECEIVED:     ['UNDER_REPAIR'],
  UNDER_REPAIR:         ['TESTING', 'AWAITING_PARTS'],
  REPAIR_COMPLETE:      ['READY_FOR_HANDOVER', 'OUT_FOR_DELIVERY', 'DELIVERED'],
  OUT_FOR_DELIVERY:     ['DELIVERED'],
};
