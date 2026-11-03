import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { NotificationType, NotificationStatus } from '../common/enums';
import { User } from '../users/user.entity';
import { ServiceRequest } from '../service-requests/entities/service-request.entity';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => ServiceRequest, { nullable: true })
  @JoinColumn({ name: 'service_request_id' })
  serviceRequest: ServiceRequest;

  @Column({ name: 'service_request_id', nullable: true })
  serviceRequestId: string;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'varchar', nullable: true, length: 100 })
  title: string | null;

  @Column({ name: 'offer_id', type: 'uuid', nullable: true })
  offerId: string | null;

  @Column({ name: 'deep_link', type: 'varchar', nullable: true, length: 300 })
  deepLink: string | null;

  @Column({ type: 'enum', enum: NotificationStatus, default: NotificationStatus.PENDING })
  status: NotificationStatus;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ name: 'sent_at' })
  sentAt: Date;
}
