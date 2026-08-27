export enum Role {
  CUSTOMER = 'CUSTOMER',
  SUPER_ADMIN = 'SUPER_ADMIN',
  TECHNICIAN = 'TECHNICIAN',
  OPERATIONS = 'OPERATIONS',
  DELIVERY_AGENT = 'DELIVERY_AGENT',
}

export enum ServiceRequestStatus {
  PICKUP_SCHEDULED = 'PICKUP_SCHEDULED',
  PICKED_UP = 'PICKED_UP',
  RECEIVED_AT_WORKSHOP = 'RECEIVED_AT_WORKSHOP',
  DIAGNOSED = 'DIAGNOSED',
  QUOTATION_SHARED = 'QUOTATION_SHARED',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  UNDER_REPAIR = 'UNDER_REPAIR',
  REPAIR_COMPLETE = 'REPAIR_COMPLETE',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
}

export enum AssignmentType {
  PICKUP = 'PICKUP',
  DELIVERY = 'DELIVERY',
}

export enum AssignmentStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum PhotoType {
  PICKUP = 'PICKUP',       // collected from customer
  WAREHOUSE = 'WAREHOUSE', // received at workshop/office
  DELIVERY = 'DELIVERY',   // handed back to customer
}

export enum NotificationType {
  PUSH = 'PUSH',
  SMS = 'SMS',
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  CAPTURED = 'CAPTURED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentMethod {
  UPI = 'UPI',
  CARD = 'CARD',
  NET_BANKING = 'NET_BANKING',
  CASH = 'CASH',
}

export const ISSUE_CATEGORIES = [
  'Screen issues',
  'Battery & charging issues',
  'Keyboard & touchpad issues',
  'Hinge & body damage',
  'Motherboard & hardware issues',
  'Performance issues',
  'Heating & fan issues',
  'Storage & data issues',
  'Software & operating system issues',
  'Network & connectivity issues',
  'Audio & camera issues',
  'Peripheral & port issues',
  'Gaming laptop issues',
  'Apple / MacBook specific issues',
  'Printer & scanner issues',
  'Upgrade & installation services',
  'Virus & cybersecurity issues',
  'Data backup & recovery',
  'Backup solution',
  'CCTV installation',
  'Custom PC / workstation issues',
] as const;

export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

export const DEVICE_BRANDS = [
  'HP',
  'Dell',
  'Lenovo',
  'Asus',
  'Acer',
  'Apple',
  'Samsung',
  'MSI',
  'Gigabyte',
  'Other',
] as const;
