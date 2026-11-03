import { Entity, PrimaryColumn, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('repair_warranties')
export class RepairWarranty {
  @PrimaryColumn('uuid', { name: 'service_request_id' }) serviceRequestId: string;
  @Column('date', { name: 'starts_on' }) startsOn: string;
  @Column('date', { name: 'ends_on' }) endsOn: string;
  @Column('text') coverage: string;
  @Column('uuid', { name: 'updated_by' }) updatedBy: string;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}

export type ClaimStatus = 'REQUESTED' | 'IN_PROGRESS' | 'DECLINED' | 'RESOLVED';

@Entity('warranty_claims')
export class WarrantyClaim {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid', { name: 'service_request_id' }) serviceRequestId: string;
  @Column('text') description: string;
  @Column('varchar', { default: 'REQUESTED' }) status: ClaimStatus;
  @Column('jsonb', { name: 'coverage_snapshot' }) coverageSnapshot: { startsOn: string; endsOn: string; coverage: string };
  @Column('jsonb', { default: [] }) history: { status: ClaimStatus; note: string; at: string; actorId: string }[];
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
