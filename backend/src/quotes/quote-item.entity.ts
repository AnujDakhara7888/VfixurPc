import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
} from 'typeorm';
import { ServiceRequest } from '../service-requests/entities/service-request.entity';

@Entity('quote_items')
export class QuoteItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ServiceRequest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'service_request_id' })
  serviceRequest: ServiceRequest;

  @Column({ name: 'service_request_id' })
  serviceRequestId: string;

  // Short item name shown in the invoice's first table line (e.g. "SSD").
  @Column({ name: 'item_name', nullable: true })
  itemName: string;

  @Column()
  description: string;

  // HSN (goods) / SAC (services) tax code. Defaults to the general repair SAC.
  @Column({ name: 'hsn_sac', default: '998713' })
  hsnSac: string;

  // Unit of measure shown on the invoice (PC, NOS, HRS…).
  @Column({ default: 'PC' })
  unit: string;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 10, scale: 2 })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total: number;

  @Column({ name: 'tax_rate', type: 'decimal', precision: 5, scale: 2, default: 18 })
  taxRate: number; // 18% GST (9% CGST + 9% SGST)
}
