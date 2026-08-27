export type Role = 'CUSTOMER' | 'SUPER_ADMIN' | 'TECHNICIAN' | 'OPERATIONS' | 'DELIVERY_AGENT';

export type ServiceRequestStatus =
  | 'PICKUP_SCHEDULED'
  | 'PICKED_UP'
  | 'RECEIVED_AT_WORKSHOP'
  | 'DIAGNOSED'
  | 'QUOTATION_SHARED'
  | 'PAYMENT_RECEIVED'
  | 'UNDER_REPAIR'
  | 'REPAIR_COMPLETE'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  username: string;
  role: Role;
  isActive?: boolean;
  createdAt: string;
}

export interface Device {
  id: string;
  brand: string;
  model: string;
  serialNumber?: string;
  condition?: string;
}

export interface IssueSelection {
  id: string;
  category: string;
  description?: string;
}

export interface StatusHistory {
  id: string;
  fromStatus?: ServiceRequestStatus;
  toStatus: ServiceRequestStatus;
  changedBy?: User;
  notes?: string;
  createdAt: string;
}

export interface QuoteItem {
  id: string;
  itemName?: string;
  description: string;
  hsnSac?: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ServiceRequest {
  id: string;
  ticketNumber: string;
  serviceRequestNumber?: string;
  status: ServiceRequestStatus;
  customer: User;
  device: Device;
  issues: IssueSelection[];
  assignedTechnician?: User;
  assignedTechnicianId?: string | null;
  pickupAddress: string;
  pickupDate?: string;
  pickupSlotDate?: string;
  pickupSlotTime?: string;
  pickupSlot?: { label: string; startTime: string; endTime: string };
  quoteItems?: QuoteItem[];
  quotedTotal?: number;
  notes?: string;
  statusHistory?: StatusHistory[];
  createdAt: string;
  updatedAt: string;
}

export interface PickupSlot {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  serviceRequest: { ticketNumber: string; id: string };
  customer: User;
  subtotal: number;
  cgst: number;
  sgst: number;
  total: number;
  createdAt: string;
  pdfUrl?: string;
}

export interface DashboardStats {
  openTickets: number;
  inRepair: number;
  delivered: number;
  total: number;
  todayRevenue: number;
  totalRevenue: number;
  pipeline: { status: string; count: string }[];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
