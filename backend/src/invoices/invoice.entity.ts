import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { ServiceRequest } from '../service-requests/entities/service-request.entity';

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ServiceRequest)
  @JoinColumn({ name: 'service_request_id' })
  serviceRequest: ServiceRequest;

  @Column({ name: 'service_request_id' })
  serviceRequestId: string;

  @Column({ name: 'invoice_number', unique: true })
  invoiceNumber: string; // Vfx-XXX

  @Column({ name: 'pdf_s3_url', nullable: true })
  pdfS3Url: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  cgst: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  sgst: number;

  @Column({ name: 'taxable_amount', type: 'decimal', precision: 10, scale: 2 })
  taxableAmount: number;

  @Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ name: 'round_off', type: 'decimal', precision: 6, scale: 2, default: 0 })
  roundOff: number;

  @Column({ name: 'invoice_date', type: 'date', nullable: true })
  invoiceDate: string;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: string;

  @Column({ name: 'amount_in_words', nullable: true, type: 'text' })
  amountInWords: string;

  @Column({ name: 'reverse_charge', default: false })
  reverseCharge: boolean;

  @Column({ name: 'place_of_supply', nullable: true })
  placeOfSupply: string;

  // ── Buyer snapshot (so the invoice never changes if the customer record does) ──
  @Column({ name: 'buyer_name', nullable: true })
  buyerName: string;

  @Column({ name: 'buyer_company', nullable: true })
  buyerCompany: string;

  @Column({ name: 'buyer_contact', nullable: true })
  buyerContact: string;

  @Column({ name: 'buyer_phone', nullable: true })
  buyerPhone: string;

  @Column({ name: 'buyer_email', nullable: true })
  buyerEmail: string;

  @Column({ name: 'buyer_gstin', nullable: true })
  buyerGstin: string;

  @Column({ name: 'buyer_pan', nullable: true })
  buyerPan: string;

  @Column({ name: 'billing_address', nullable: true, type: 'text' })
  billingAddress: string;

  @Column({ name: 'shipping_address', nullable: true, type: 'text' })
  shippingAddress: string;

  // Frozen copy of the quote lines at the moment of invoicing.
  @Column({ name: 'line_items', type: 'jsonb', nullable: true })
  lineItems: InvoiceLineItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

export interface InvoiceLineItem {
  itemName?: string;
  description: string;
  hsnSac: string;
  unit: string;
  quantity: number;
  unitPrice: number;   // taxable unit price
  taxRate: number;     // total GST %
  taxableValue: number;
  cgst: number;
  sgst: number;
  amount: number;      // gross (incl GST)
}
