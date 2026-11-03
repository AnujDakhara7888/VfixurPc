import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type OfferType = 'PERCENTAGE' | 'FIXED_DISCOUNT' | 'FREE_ADD_ON' | 'CONSULTATION';
export type CustomerSegment = 'ALL_CUSTOMERS' | 'RETURNING_CUSTOMERS' | 'INACTIVE_CUSTOMERS';

@Entity('offers')
export class Offer {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ length: 120 }) title: string;
  @Column({ name: 'short_description', length: 240 }) shortDescription: string;
  @Column({ name: 'offer_type', length: 32 }) offerType: OfferType;
  @Column({ name: 'discount_value', type: 'numeric', precision: 10, scale: 2, default: 0 }) discountValue: number;
  @Column({ name: 'maximum_discount_cap', type: 'integer', default: 0 }) maximumDiscountCap: number;
  @Column({ name: 'minimum_billing_amount', type: 'integer', default: 0 }) minimumBillingAmount: number;
  @Column({ name: 'eligible_service_categories', type: 'jsonb', default: () => "'[]'::jsonb" }) eligibleServiceCategories: string[];
  @Column({ name: 'eligible_customer_segment', length: 32, default: 'ALL_CUSTOMERS' }) eligibleCustomerSegment: CustomerSegment;
  @Column({ name: 'inactive_days', type: 'integer', default: 90 }) inactiveDays: number;
  @Column({ name: 'start_at', type: 'timestamptz' }) startAt: Date;
  @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt: Date;
  @Column({ name: 'promo_code', type: 'varchar', length: 40, nullable: true }) promoCode: string | null;
  @Column({ default: false }) active: boolean;
  @Column({ name: 'usage_limit_per_customer', type: 'integer', default: 1 }) usageLimitPerCustomer: number;
  @Column({ name: 'deep_link_destination', length: 200, default: 'offer' }) deepLinkDestination: string;
  @Column({ name: 'cta_label', length: 40, default: 'View Offer' }) ctaLabel: string;
  @Column({ name: 'push_title', length: 100 }) pushTitle: string;
  @Column({ name: 'push_body', length: 220 }) pushBody: string;
  @Column({ name: 'whatsapp_template_name', type: 'varchar', length: 120, nullable: true }) whatsappTemplateName: string | null;
  @Column({ name: 'whatsapp_language', type: 'varchar', length: 12, default: 'en' }) whatsappLanguage: string;
  @Column({ name: 'whatsapp_parameters', type: 'jsonb', default: () => "'[]'::jsonb" }) whatsappParameters: string[];
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

@Entity('offer_claims')
export class OfferClaim {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'offer_id', type: 'uuid' }) offerId: string;
  @Column({ name: 'user_id', type: 'uuid' }) userId: string;
  @Column({ name: 'booking_id', type: 'uuid' }) bookingId: string;
  @CreateDateColumn({ name: 'claimed_at' }) claimedAt: Date;
}
