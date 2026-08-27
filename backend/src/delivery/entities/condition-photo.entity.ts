import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { PhotoType } from '../../common/enums';
import { DeliveryAssignment } from './delivery-assignment.entity';

@Entity('condition_photos')
export class ConditionPhoto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => DeliveryAssignment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assignment_id' })
  assignment: DeliveryAssignment;

  @Column({ name: 'assignment_id' })
  assignmentId: string;

  @Column({ name: 's3_url' })
  s3Url: string;

  @Column({ type: 'enum', enum: PhotoType })
  type: PhotoType;

  @CreateDateColumn({ name: 'uploaded_at' })
  uploadedAt: Date;
}
