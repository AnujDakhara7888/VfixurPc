/**
 * One-time seed script — run with:  npx ts-node src/seed.ts
 * Creates 30-min pickup slots 9am–9pm and a SUPER_ADMIN user.
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
dotenv.config();

import { User } from './users/user.entity';
import { PickupSlot } from './admin/pickup-slot.entity';
import { Role } from './common/enums';
import { Device } from './devices/device.entity';
import { ServiceRequest } from './service-requests/entities/service-request.entity';
import { StatusHistory } from './service-requests/entities/status-history.entity';
import { IssueSelection } from './service-requests/entities/issue-selection.entity';
import { QuoteItem } from './quotes/quote-item.entity';
import { Payment } from './payments/payment.entity';
import { Invoice } from './invoices/invoice.entity';
import { Notification } from './notifications/notification.entity';
import { DeliveryAssignment } from './delivery/entities/delivery-assignment.entity';
import { ConditionPhoto } from './delivery/entities/condition-photo.entity';
import { FaqNode } from './faq/faq-node.entity';

/** Format hour/minute to "9:00 AM" style */
function fmt(h: number, m: number): string {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** Generate every 30-minute slot entry from 9:00 AM to 9:00 PM */
function generateSlots(): { label: string; startTime: string; endTime: string }[] {
  const slots: { label: string; startTime: string; endTime: string }[] = [];
  let hour = 9;
  let minute = 0;

  while (!(hour === 21 && minute === 0)) {
    const startH = hour, startM = minute;
    let endH = hour, endM = minute + 30;
    if (endM >= 60) { endM -= 60; endH += 1; }
    if (endH > 21 || (endH === 21 && endM > 0)) break;

    const startTime = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;
    const endTime   = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
    const label     = `${fmt(startH, startM)} – ${fmt(endH, endM)}`;
    slots.push({ label, startTime, endTime });

    minute += 30;
    if (minute >= 60) { minute -= 60; hour += 1; }
  }
  return slots;
}

async function seed() {
  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    synchronize: true,
    ssl: true,
    extra: { ssl: { rejectUnauthorized: false } },
    entities: [
      User, Device, ServiceRequest, StatusHistory, IssueSelection,
      QuoteItem, Payment, Invoice, Notification, DeliveryAssignment,
      ConditionPhoto, FaqNode, PickupSlot,
    ],
  });
  await ds.initialize();

  // ── Pickup Slots (30-min intervals, 9 AM – 9 PM) ─────────────────────
  const slotRepo = ds.getRepository(PickupSlot);
  const existingCount = await slotRepo.count();
  if (existingCount === 0) {
    const slotsData = generateSlots();
    for (const s of slotsData) {
      await slotRepo.save(slotRepo.create({ ...s, isActive: true }));
    }
    console.log(`✓ Created ${slotsData.length} pickup slots (9:00 AM – 9:00 PM, every 30 min)`);
  } else {
    console.log(`  Skipping slots — ${existingCount} already exist`);
  }

  // ── Super Admin ───────────────────────────────────────────────────────
  const userRepo = ds.getRepository(User);
  const adminExists = await userRepo.findOne({ where: { username: 'superadmin' } });
  if (!adminExists) {
    const passwordHash = await bcrypt.hash('Admin@1234', 10);
    await userRepo.save(userRepo.create({
      name: 'Super Admin',
      email: 'admin@vfixurpc.com',
      phone: '+919999999999',
      username: 'superadmin',
      passwordHash,
      role: Role.SUPER_ADMIN,
    }));
    console.log('✓ Super admin created — username: superadmin / password: Admin@1234');
  } else {
    console.log('  Super admin already exists');
  }

  await ds.destroy();
  console.log('\nSeed complete!');
}

seed().catch((e) => { console.error(e); process.exit(1); });
