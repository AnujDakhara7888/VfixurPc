export type Role = 'CUSTOMER' | 'SUPER_ADMIN' | 'TECHNICIAN' | 'OPERATIONS' | 'DELIVERY_AGENT';

export type SRStatus =
  | 'PICKUP_SCHEDULED' | 'PICKED_UP' | 'RECEIVED_AT_WORKSHOP' | 'DIAGNOSED'
  | 'QUOTATION_SHARED' | 'PAYMENT_RECEIVED' | 'UNDER_REPAIR'
  | 'REPAIR_COMPLETE' | 'OUT_FOR_DELIVERY' | 'DELIVERED';

export interface User {
  id: string; name: string; email: string; phone: string; username: string; role: Role;
}

export interface Device {
  id: string; brand: string; model: string; serialNumber?: string; condition?: string;
}

export interface PickupSlot {
  id: string; label: string; startTime: string; endTime: string; isActive: boolean;
}

export interface QuoteItem {
  id: string; description: string; quantity: number; unitPrice: number; totalPrice: number;
}

export interface StatusHistory {
  id: string; fromStatus?: SRStatus; toStatus: SRStatus; notes?: string; createdAt: string;
}

export interface IssueItem {
  id: string; category: string; description?: string;
}

export interface ServiceRequest {
  id: string;
  serviceRequestNumber?: string;
  ticketNumber?: string;
  status: SRStatus;
  customer: User;
  device: Device;
  issues: IssueItem[];
  pickupAddress: string;
  pickupSlotDate?: string;
  pickupDate?: string;
  pickupSlotTime?: string;
  pickupSlot?: PickupSlot;
  quoteItems?: QuoteItem[];
  quotedTotal?: number;
  notes?: string;
  statusHistory?: StatusHistory[];
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string; type: 'PUSH' | 'SMS'; message: string;
  status: 'PENDING' | 'SENT' | 'FAILED'; sentAt?: string; createdAt: string;
}

// ── Navigation ──────────────────────────────────────────────────────────
export type RootStackParamList   = { Auth: undefined; App: undefined };
export type AuthStackParamList   = { Login: undefined; Register: undefined };
export type AppTabParamList      = {
  HomeTab: undefined;
  BookTab: { screen?: keyof BookStackParamList; params?: { preselectCategory?: string } } | undefined;
  NotificationsTab: undefined;
  ProfileTab: undefined;
};
export type HomeStackParamList   = { Home: undefined; RequestDetail: { id: string }; QuoteApproval: { srId: string } };
export type BookStackParamList   = {
  Step1Device: { preselectCategory?: string } | undefined;
  Step2Issues: { deviceId: string; categoryId: string; deviceName: string };
  Step3Pickup: {
    deviceId: string;
    categoryId: string;
    deviceName: string;
    issues: { category: string; description?: string }[];
    issueLabels: string[];
  };
  BookingSuccess: { ticketNumber: string };
};
