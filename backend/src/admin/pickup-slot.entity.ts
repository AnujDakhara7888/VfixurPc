import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('pickup_slots')
export class PickupSlot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  label: string; // e.g. "All Day"

  @Column({ name: 'start_time' })
  startTime: string; // "09:00"

  @Column({ name: 'end_time' })
  endTime: string; // "21:00"

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
