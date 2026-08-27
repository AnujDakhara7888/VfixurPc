import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO } from 'date-fns';
import type { ServiceRequestStatus } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string) {
  try { return format(parseISO(iso), 'dd MMM yyyy, hh:mm a'); }
  catch { return iso; }
}

export function formatDateShort(iso: string) {
  try { return format(parseISO(iso), 'dd MMM yyyy'); }
  catch { return iso; }
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
}

export const STATUS_COLORS: Record<ServiceRequestStatus, string> = {
  PICKUP_SCHEDULED:     'bg-blue-100 text-blue-700',
  PICKED_UP:            'bg-indigo-100 text-indigo-700',
  RECEIVED_AT_WORKSHOP: 'bg-purple-100 text-purple-700',
  DIAGNOSED:            'bg-yellow-100 text-yellow-700',
  QUOTATION_SHARED:     'bg-orange-100 text-orange-700',
  PAYMENT_RECEIVED:     'bg-lime-100 text-lime-700',
  UNDER_REPAIR:         'bg-cyan-100 text-cyan-700',
  REPAIR_COMPLETE:      'bg-teal-100 text-teal-700',
  OUT_FOR_DELIVERY:     'bg-sky-100 text-sky-700',
  DELIVERED:            'bg-green-100 text-green-700',
};

export const STATUS_LABELS: Record<ServiceRequestStatus, string> = {
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
  PICKUP_SCHEDULED:     ['PICKED_UP'],
  PICKED_UP:            ['RECEIVED_AT_WORKSHOP'],
  RECEIVED_AT_WORKSHOP: ['DIAGNOSED'],
  DIAGNOSED:            ['QUOTATION_SHARED'],
  QUOTATION_SHARED:     ['UNDER_REPAIR', 'PAYMENT_RECEIVED'],
  PAYMENT_RECEIVED:     ['UNDER_REPAIR'],
  UNDER_REPAIR:         ['REPAIR_COMPLETE'],
  REPAIR_COMPLETE:      ['OUT_FOR_DELIVERY'],
  OUT_FOR_DELIVERY:     ['DELIVERED'],
};
