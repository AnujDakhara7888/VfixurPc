import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ServiceRequest } from '../service-requests/entities/service-request.entity';
@Entity('ticket_attachments')
export class TicketAttachment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'service_request_id' }) serviceRequestId: string;
  @ManyToOne(() => ServiceRequest)
  @JoinColumn({ name: 'service_request_id' })
  serviceRequest: ServiceRequest;
  @Column() caption: string;
  @Column() mime: string;
  @Column({ name: 'uploaded_by' }) uploadedBy: string;
  @Column({ name: 'file_data', type: 'bytea', select: false }) fileData: Buffer;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
