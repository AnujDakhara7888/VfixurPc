import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('bookings')
export class Booking {
  @PrimaryColumn('uuid') id: string;
  @Column({ name: 'customer_id', type: 'uuid' }) customerId: string;
  @Column({ unique: true }) reference: string;
  @Column({ name: 'service_mode' }) serviceMode: string;
  @Column({ name: 'transport_base', type: 'integer', default: 0 }) transportBase: number;
  @Column({ name: 'transport_tax', type: 'integer', default: 0 }) transportTax: number;
  @Column({ name: 'referral_discount_percent', type: 'integer', default: 0 }) referralDiscountPercent: number;
  @Column({ name: 'offer_id', type: 'uuid', nullable: true }) offerId: string | null;
  @Column({ name: 'fee_policy_version' }) feePolicyVersion: string;
  @Column({ name: 'accepted_at', type: 'timestamptz' }) acceptedAt: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
