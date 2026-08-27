import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PickupSlot } from './pickup-slot.entity';
import { ServiceRequest } from '../service-requests/entities/service-request.entity';
import { Payment } from '../payments/payment.entity';
import { ServiceRequestStatus, PaymentStatus } from '../common/enums';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePickupSlotDto {
  @IsString() @IsNotEmpty() label: string;
  @IsString() @IsNotEmpty() startTime: string;
  @IsString() @IsNotEmpty() endTime: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(PickupSlot) private slotRepo: Repository<PickupSlot>,
    @InjectRepository(ServiceRequest) private srRepo: Repository<ServiceRequest>,
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
  ) {}

  // ---- Pickup Slots ----
  async getSlots() {
    return this.slotRepo.find({ where: { isActive: true }, order: { startTime: 'ASC' } });
  }

  async getAllSlots() {
    return this.slotRepo.find({ order: { startTime: 'ASC' } });
  }

  async createSlot(dto: CreatePickupSlotDto) {
    const slot = this.slotRepo.create(dto);
    return this.slotRepo.save(slot);
  }

  async updateSlot(id: string, dto: Partial<CreatePickupSlotDto>) {
    await this.slotRepo.update(id, dto);
    const slot = await this.slotRepo.findOne({ where: { id } });
    if (!slot) throw new NotFoundException();
    return slot;
  }

  async deleteSlot(id: string) {
    await this.slotRepo.delete(id);
  }

  /**
   * Replace all pickup slots with evenly-spaced intervals between an opening
   * and closing hour. Defaults to 30-minute slots from 9:00 AM to 9:00 PM.
   */
  async generateSlots(opts?: { startHour?: number; endHour?: number; intervalMinutes?: number }) {
    const startHour = opts?.startHour ?? 9;
    const endHour = opts?.endHour ?? 21;
    const step = opts?.intervalMinutes ?? 30;

    const pad = (n: number) => String(n).padStart(2, '0');
    const to12h = (h: number, m: number) => {
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 === 0 ? 12 : h % 12;
      return `${h12}:${pad(m)} ${ampm}`;
    };

    const slots: { label: string; startTime: string; endTime: string; isActive: boolean }[] = [];
    for (let mins = startHour * 60; mins + step <= endHour * 60; mins += step) {
      const sH = Math.floor(mins / 60), sM = mins % 60;
      const eMins = mins + step;
      const eH = Math.floor(eMins / 60), eM = eMins % 60;
      slots.push({
        startTime: `${pad(sH)}:${pad(sM)}`,
        endTime: `${pad(eH)}:${pad(eM)}`,
        label: `${to12h(sH, sM)} – ${to12h(eH, eM)}`,
        isActive: true,
      });
    }

    // Wipe existing and recreate so the set is always clean.
    await this.slotRepo.createQueryBuilder().delete().execute();
    await this.slotRepo.save(slots.map((s) => this.slotRepo.create(s)));
    return this.getAllSlots();
  }

  // ---- Dashboard KPIs ----
  async getDashboardStats() {
    const CLOSED = ServiceRequestStatus.DELIVERED;

    // All active (not delivered) = openTickets
    const [openTickets, inRepair, delivered, total] = await Promise.all([
      this.srRepo
        .createQueryBuilder('sr')
        .where('sr.status != :delivered', { delivered: CLOSED })
        .getCount(),
      this.srRepo.count({ where: { status: ServiceRequestStatus.UNDER_REPAIR } }),
      this.srRepo.count({ where: { status: CLOSED } }),
      this.srRepo.count(),
    ]);

    // ── Revenue ──────────────────────────────────────────────────────────
    // Revenue is recognised once a customer has paid (PAYMENT_RECEIVED) and for
    // every stage after that. We derive it from the approved quote line items
    // (price + GST) rather than the payments table, which may not be wired to a
    // gateway yet — so the figure is real as soon as quotes exist.
    const PAID_STATES = [
      ServiceRequestStatus.PAYMENT_RECEIVED,
      ServiceRequestStatus.UNDER_REPAIR,
      ServiceRequestStatus.REPAIR_COMPLETE,
      ServiceRequestStatus.OUT_FOR_DELIVERY,
      ServiceRequestStatus.DELIVERED,
    ];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const revenueExpr = 'COALESCE(SUM(qi.total * (1 + qi.tax_rate / 100)), 0)';

    const [totalRow, todayRow, capturedRow] = await Promise.all([
      this.srRepo
        .createQueryBuilder('sr')
        .innerJoin('sr.quoteItems', 'qi')
        .where('sr.status IN (:...paid)', { paid: PAID_STATES })
        .select(revenueExpr, 'total')
        .getRawOne(),
      this.srRepo
        .createQueryBuilder('sr')
        .innerJoin('sr.quoteItems', 'qi')
        .where('sr.status IN (:...paid)', { paid: PAID_STATES })
        .andWhere('sr.updated_at >= :today', { today })
        .select(revenueExpr, 'total')
        .getRawOne(),
      // If real payments do exist, prefer them for "today".
      this.paymentRepo
        .createQueryBuilder('p')
        .where('p.status = :status', { status: PaymentStatus.CAPTURED })
        .andWhere('p.created_at >= :today', { today })
        .select('COALESCE(SUM(p.amount), 0)', 'total')
        .getRawOne(),
    ]);

    const totalRevenue = Math.round(Number(totalRow?.total ?? 0));
    const capturedToday = Number(capturedRow?.total ?? 0);
    const todayRevenue = Math.round(
      capturedToday > 0 ? capturedToday : Number(todayRow?.total ?? 0),
    );

    // Pipeline by stage
    const pipeline = await this.srRepo
      .createQueryBuilder('sr')
      .select('sr.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('sr.status')
      .orderBy('COUNT(*)', 'DESC')
      .getRawMany();

    return {
      openTickets,
      inRepair,
      delivered,
      total,
      todayRevenue,
      totalRevenue,
      pipeline,
    };
  }

  // ---- Analytics ----
  async getRevenueByDate(from: string, to: string) {
    return this.paymentRepo
      .createQueryBuilder('p')
      .select("DATE_TRUNC('day', p.created_at)", 'date')
      .addSelect('SUM(p.amount)', 'total')
      .where('p.status = :status', { status: PaymentStatus.CAPTURED })
      .andWhere('p.created_at BETWEEN :from AND :to', { from, to })
      .groupBy("DATE_TRUNC('day', p.created_at)")
      .orderBy('date', 'ASC')
      .getRawMany();
  }
}
