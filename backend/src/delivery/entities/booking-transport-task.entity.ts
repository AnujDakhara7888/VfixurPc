import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, ManyToOne, JoinColumn } from 'typeorm';
import { Booking } from '../../service-requests/entities/booking.entity';
import { User } from '../../users/user.entity';

@Entity('booking_transport_tasks')
@Unique('UQ_booking_transport_direction', ['bookingId', 'direction'])
export class BookingTransportTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'booking_id', type: 'uuid' })
  bookingId: string;

  @ManyToOne(() => Booking, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'booking_id', foreignKeyConstraintName: 'FK_transport_booking' })
  booking: Booking;

  @Column({ name: 'request_ids', type: 'uuid', array: true })
  requestIds: string[];

  @Column({ type: 'varchar', length: 10 })
  direction: 'PICKUP' | 'RETURN';

  @Column({ type: 'varchar', length: 16, default: 'PLANNED' })
  status: 'PLANNED' | 'ASSIGNED' | 'COMPLETED' | 'CANCELLED';

  @Column({ name: 'agent_id', type: 'uuid', nullable: true })
  agentId: string | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'agent_id', foreignKeyConstraintName: 'FK_transport_agent' })
  agent: User | null;

  @Column({ name: 'scheduled_date', type: 'date', nullable: true })
  scheduledDate: string | null;

  @Column({ name: 'scheduled_slot', type: 'varchar', length: 80, nullable: true })
  scheduledSlot: string | null;

  @Column({ type: 'integer', default: 0 })
  version: number;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'completed_by', type: 'uuid', nullable: true })
  completedBy: string | null;

  @Column({ name: 'received_by', type: 'varchar', length: 120, nullable: true })
  receivedBy: string | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @Column({ name: 'cancelled_by', type: 'uuid', nullable: true })
  cancelledBy: string | null;

  @Column({ name: 'cancellation_reason', type: 'varchar', length: 500, nullable: true })
  cancellationReason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
