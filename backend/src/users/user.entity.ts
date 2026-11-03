import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, OneToMany,
} from 'typeorm';
import { Role } from '../common/enums';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ unique: true })
  phone: string;

  @Column({ unique: true })
  username: string;

  @Column({ name: 'password_hash', select: false })
  passwordHash: string;

  @Column({ type: 'enum', enum: Role, default: Role.CUSTOMER })
  role: Role;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'fcm_token', nullable: true, select: false })
  fcmToken: string;

  @Column({ name: 'promotional_push_opt_in', default: false })
  promotionalPushOptIn: boolean;

  @Column({ name: 'promotional_whatsapp_opt_in', default: false })
  promotionalWhatsappOptIn: boolean;

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth: string | null;

  @Column({ name: 'refresh_token', nullable: true, select: false, type: 'varchar' })
  refreshToken: string | null;

  @Column({ name: 'token_version', default: 0 })
  tokenVersion: number;

  @Column({ name: 'referred_by_user_id', type: 'uuid', nullable: true })
  referredByUserId: string | null;

  @Column({ name: 'referral_discount_used_at', type: 'timestamptz', nullable: true })
  referralDiscountUsedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
