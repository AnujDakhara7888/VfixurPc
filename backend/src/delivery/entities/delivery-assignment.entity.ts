import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { AssignmentType, AssignmentStatus } from '../../common/enums';
import { ServiceRequest } from '../../service-requests/entities/service-request.entity';
import { User } from '../../users/user.entity';

@Entity('delivery_assignments')
export class DeliveryAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ServiceRequest)
  @JoinColumn({ name: 'service_request_id' })
  serviceRequest: ServiceRequest;

  @Column({ name: 'service_request_id' })
  serviceRequestId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'agent_id' })
  agent: User;

  @Column({ name: 'agent_id' })
  agentId: string;

  @Column({ type: 'enum', enum: AssignmentType })
  type: AssignmentType;

  @Column({ type: 'enum', enum: AssignmentStatus, default: AssignmentStatus.PENDING })
  status: AssignmentStatus;

  @Column({ name: 'scheduled_date', type: 'date' })
  scheduledDate: string;

  @Column({ name: 'scheduled_slot' })
  scheduledSlot: string;

  @Column({ nullable: true })
  otp: string;

  @Column({ name: 'otp_verified', default: false })
  otpVerified: boolean;

  @Column({ name: 'completed_at', nullable: true })
  completedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
