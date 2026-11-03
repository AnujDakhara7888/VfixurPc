export type Role = 'CUSTOMER' | 'SUPER_ADMIN' | 'TECHNICIAN' | 'OPERATIONS' | 'DELIVERY_AGENT';

export type SRStatus =
  | 'REQUEST_RECEIVED' | 'DIAGNOSING' | 'QUOTE_APPROVED' | 'QUOTE_REJECTED' | 'AWAITING_PARTS' | 'TESTING' | 'READY_FOR_HANDOVER' | 'CANCELLED'
  | 'PICKUP_SCHEDULED' | 'PICKED_UP' | 'RECEIVED_AT_WORKSHOP' | 'DIAGNOSED'
  | 'QUOTATION_SHARED' | 'PAYMENT_RECEIVED' | 'UNDER_REPAIR'
  | 'REPAIR_COMPLETE' | 'OUT_FOR_DELIVERY' | 'DELIVERED';

export interface User {
  id: string; name: string; email: string; phone: string; username: string; role: Role; dateOfBirth?: string | null;
}

export interface Device {
  id: string; brand: string; model: string; serialNumber?: string; condition?: string;
}

export interface PickupSlot {
  id: string; label: string; startTime: string; endTime: string; isActive: boolean;
}

export interface QuoteItem {
  taxRate?: number;
  id: string; itemName?: string; description: string; hsnSac?: string; unit?: string; quantity: number; unitPrice: number; totalPrice: number;
}

export interface StatusHistory {
  id: string; fromStatus?: SRStatus; toStatus: SRStatus; notes?: string; createdAt: string;
}

export interface IssueItem {
  id: string; category: string; description?: string;
}

export interface ServiceRequest {
  bookingId?: string;
  bookingPosition?: number;
  relatedRequests?: { id: string; serviceRequestNumber: string; status: SRStatus; device?: Device; serviceCategory?: string }[];
  booking?: { id: string; reference: string; serviceMode: string; transportBase: number; transportTax: number; referralDiscountPercent?: number; feePolicyVersion: string };
  rejectionFeeTotal?: number | null;
  returnDeliveryFeeTotal?: number | null;
  handoverMethod?: 'CUSTOMER_COLLECTION' | 'DELIVERY' | null;
  serviceCategory?: string;
  serviceMode?: string;
  bookingAnswers?: Record<string,string|string[]>;
  quoteApproved?: boolean;
  quoteRejectedReason?: string;
  quoteVersion?: number;
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
  readAt?: string | null;
  serviceRequestId?: string;
  offerId?: string;
  title?: string;
  deepLink?: string;
  id: string; type: 'PUSH' | 'SMS'; message: string;
  status: 'PENDING' | 'SENT' | 'FAILED'; sentAt?: string; createdAt: string;
}

export interface Offer {
  id: string; title: string; shortDescription: string;
  offerType: 'PERCENTAGE' | 'FIXED_DISCOUNT' | 'FREE_ADD_ON' | 'CONSULTATION';
  discountValue: number; maximumDiscountCap: number; minimumBillingAmount: number;
  eligibleServiceCategories: string[]; eligibleCustomerSegment: string;
  startAt: string; expiresAt: string; promoCode?: string | null; ctaLabel: string;
  remainingUses: number;
}

export interface AppliedDiscount {
  kind: 'OFFER' | 'REFERRAL'; code: string; title: string; description: string;
  offerId?: string; percent?: number; maximumDiscountCap?: number; minimumBillingAmount?: number;
}

// ── Navigation ──────────────────────────────────────────────────────────
export type RootStackParamList   = { Auth: undefined; App: undefined; Notifications: undefined };
export type AuthStackParamList   = { Login: undefined; Register: undefined; ForgotPassword: undefined; Legal: { kind: 'privacy' | 'terms' } };
export type AppTabParamList      = {
  HomeTab: undefined;
  OrdersTab: undefined;
  BookTab: { screen?: keyof BookStackParamList; params?: { preselectCategory?: string } } | undefined;
  NotificationsTab: undefined;
  ProfileTab: { screen?: keyof ProfileStackParamList } | undefined;
};
export type HomeStackParamList   = { Home: undefined; Orders: undefined; OfferDetail: { id: string }; RequestDetail: { id: string }; QuoteApproval: { srId: string } };
export type ProfileStackParamList = { Profile: undefined; ChangeEmail: undefined; DeleteAccount: undefined; Faq: undefined; MyDevices: undefined; Legal: {kind:'privacy'|'terms'} };
export type BookStackParamList   = {
  Step1Device: { preselectCategory?: string; savedDeviceId?: string } | undefined;
  Step2Issues: { categoryId: string; deviceId?: string };
  Step3Pickup: {
    deviceId?: string;
    categoryId: string;
    deviceName?: string;
    bookingAnswers?: Record<string,string|string[]>;
    issues: { category: string; description?: string }[];
    issueLabels?: string[];
  };
  BookingSuccess: { ticketNumber: string; id?: string; mode?: string; count?: number };
};
