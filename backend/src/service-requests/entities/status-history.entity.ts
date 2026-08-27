import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { ServiceRequestStatus } from '../../common/enums';
import { ServiceRequest } from './service-request.entity';
import { User } from '../../users/user.entity';

@Entity('status_history')
export class StatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ServiceRequest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'service_request_id' })
  serviceRequest: ServiceRequest;

  @Column({ name: 'service_request_id' })
  serviceRequestId: string;

  @Column({ name: 'from_status', type: 'enum', enum: ServiceRequestStatus, nullable: true })
  fromStatus: ServiceRequestStatus;

  @Column({ name: 'to_status', type: 'enum', enum: ServiceRequestStatus })
  toStatus: ServiceRequestStatus;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'changed_by' })
  changedBy: User;

  @Column({ name: 'changed_by', nullable: true })
  changedById: string;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @CreateDateColumn({ name: 'timestamp' })
  timestamp: Date;
}
