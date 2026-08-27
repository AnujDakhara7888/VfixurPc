import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn, OneToMany,
} from 'typeorm';
import { ServiceRequestStatus } from '../../common/enums';
import { User } from '../../users/user.entity';
import { Device } from '../../devices/device.entity';
import { IssueSelection } from './issue-selection.entity';
import { StatusHistory } from './status-history.entity';
import { QuoteItem } from '../../quotes/quote-item.entity';

@Entity('service_requests')
export class ServiceRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'service_request_number', unique: true })
  serviceRequestNumber: string; // VFX-XXXX

  @ManyToOne(() => User)
  @JoinColumn({ name: 'customer_id' })
  customer: User;

  @Column({ name: 'customer_id' })
  customerId: string;

  @ManyToOne(() => Device, { nullable: true })
  @JoinColumn({ name: 'device_id' })
  device: Device;

  @Column({ name: 'device_id', nullable: true })
  deviceId: string;

  @Column({
    type: 'enum',
    enum: ServiceRequestStatus,
    default: ServiceRequestStatus.PICKUP_SCHEDULED,
  })
  status: ServiceRequestStatus;

  @Column({ name: 'pickup_address', type: 'text' })
  pickupAddress: string;

  @Column({ name: 'pickup_slot_date', type: 'date' })
  pickupSlotDate: string;

  @Column({ name: 'pickup_slot_time' })
  pickupSlotTime: string;

  @Column({ name: 'diagnosis_fee_applied', default: false })
  diagnosisFeeApplied: boolean;

  @Column({ name: 'quote_approved', default: false })
  quoteApproved: boolean;

  @Column({ name: 'quote_rejected_reason', nullable: true, type: 'text' })
  quoteRejectedReason: string;

  // Device condition fields
  @Column({ nullable: true })
  scratches: string;

  @Column({ nullable: true })
  dents: string;

  @Column({ name: 'hinge_condition', nullable: true })
  hingeCondition: string;

  @Column({ name: 'screen_condition', nullable: true })
  screenCondition: string;

  @Column({ name: 'camera_working', nullable: true })
  cameraWorking: boolean;

  @Column({ name: 'laptop_starting', nullable: true })
  laptopStarting: boolean;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigned_technician_id' })
  assignedTechnician: User;

  @Column({ name: 'assigned_technician_id', nullable: true })
  assignedTechnicianId: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @OneToMany(() => IssueSelection, (issue) => issue.serviceRequest)
  issues: IssueSelection[];

  @OneToMany(() => StatusHistory, (history) => history.serviceRequest)
  statusHistory: StatusHistory[];

  @OneToMany(() => QuoteItem, (quoteItem) => quoteItem.serviceRequest)
  quoteItems: QuoteItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
