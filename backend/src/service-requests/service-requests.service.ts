import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { ServiceRequest } from './entities/service-request.entity';
import { StatusHistory } from './entities/status-history.entity';
import { IssueSelection } from './entities/issue-selection.entity';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { ServiceRequestStatus, Role } from '../common/enums';
import { Device } from '../devices/device.entity';
import { randomUUID } from 'crypto';
import { CatalogService } from '../catalog/catalog.module';
import { QuoteItem } from '../quotes/quote-item.entity';
import { PickupSlot } from '../admin/pickup-slot.entity';
import { User } from '../users/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { serviceAddress, assertModeStatus } from './service-mode';
import { Booking } from './entities/booking.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { DeliveryService } from '../delivery/delivery.service';
import { OffersService } from '../offers/offers.service';
import { assertInServiceArea } from './service-area';

const STATUS_TRANSITIONS: Record<ServiceRequestStatus, ServiceRequestStatus[]> = {
  REQUEST_RECEIVED: [ServiceRequestStatus.PICKUP_SCHEDULED, ServiceRequestStatus.RECEIVED_AT_WORKSHOP, ServiceRequestStatus.DIAGNOSING, ServiceRequestStatus.CANCELLED],
  DIAGNOSING: [ServiceRequestStatus.DIAGNOSED],
  QUOTE_APPROVED: [ServiceRequestStatus.AWAITING_PARTS, ServiceRequestStatus.UNDER_REPAIR],
  QUOTE_REJECTED: [ServiceRequestStatus.READY_FOR_HANDOVER],
  AWAITING_PARTS: [ServiceRequestStatus.UNDER_REPAIR],
  TESTING: [ServiceRequestStatus.REPAIR_COMPLETE, ServiceRequestStatus.UNDER_REPAIR],
  READY_FOR_HANDOVER: [ServiceRequestStatus.OUT_FOR_DELIVERY, ServiceRequestStatus.DELIVERED],
  CANCELLED: [],
  [ServiceRequestStatus.PICKUP_SCHEDULED]: [ServiceRequestStatus.PICKED_UP, ServiceRequestStatus.DIAGNOSING, ServiceRequestStatus.CANCELLED],
  [ServiceRequestStatus.PICKED_UP]: [ServiceRequestStatus.RECEIVED_AT_WORKSHOP],
  [ServiceRequestStatus.RECEIVED_AT_WORKSHOP]: [ServiceRequestStatus.DIAGNOSING, ServiceRequestStatus.DIAGNOSED],
  [ServiceRequestStatus.DIAGNOSED]: [ServiceRequestStatus.QUOTATION_SHARED],
  [ServiceRequestStatus.QUOTATION_SHARED]: [],
  [ServiceRequestStatus.PAYMENT_RECEIVED]: [ServiceRequestStatus.UNDER_REPAIR],
  [ServiceRequestStatus.UNDER_REPAIR]: [ServiceRequestStatus.TESTING, ServiceRequestStatus.AWAITING_PARTS],
  [ServiceRequestStatus.REPAIR_COMPLETE]: [ServiceRequestStatus.READY_FOR_HANDOVER, ServiceRequestStatus.OUT_FOR_DELIVERY, ServiceRequestStatus.DELIVERED],
  [ServiceRequestStatus.OUT_FOR_DELIVERY]: [ServiceRequestStatus.DELIVERED],
  [ServiceRequestStatus.DELIVERED]: [],
};

@Injectable()
export class ServiceRequestsService {
  constructor(
    @InjectRepository(ServiceRequest) private srRepo: Repository<ServiceRequest>,
    @InjectRepository(StatusHistory) private historyRepo: Repository<StatusHistory>,
    @InjectRepository(IssueSelection) private issueRepo: Repository<IssueSelection>,
    private dataSource: DataSource,
    private notificationsService: NotificationsService,
    private catalog: CatalogService,
    private delivery: DeliveryService,
    private offers: OffersService,
  ) {}

  async createBooking(dto: CreateBookingDto, customer: User) {
    const result = await this.dataSource.transaction(async em => {
      // Serialize this customer's retries and deletion against the complete booking transaction.
      const [active] = await em.query('SELECT is_active, referred_by_user_id, referral_discount_used_at FROM users WHERE id = $1 FOR UPDATE', [customer.id]);
      if (!active?.is_active) throw new ForbiddenException('This account is no longer active');
      const existing = await em.findOne(Booking, { where: { id: dto.id } });
      if (existing) {
        if (existing.customerId !== customer.id) throw new ForbiddenException();
        return { booking: existing, requests: await em.find(ServiceRequest, { where: { bookingId: existing.id }, order: { bookingPosition: 'ASC' } }), replay: true };
      }
      if (!['2026-09-14', '2026-10-02'].includes(dto.feePolicyVersion) || dto.feesAccepted !== true) throw new BadRequestException('Review and accept the booking fees');
      if (!dto.requests?.length || dto.requests.length > 10) throw new BadRequestException('Choose between 1 and 10 devices or services');
      const first = dto.requests[0];
      const mode = first.serviceMode;
      if (!mode || dto.requests.some(r => r.serviceMode !== mode || r.pickupSlotDate !== first.pickupSlotDate || r.pickupSlotTime !== first.pickupSlotTime || serviceAddress(mode, r.pickupAddress) !== serviceAddress(mode, first.pickupAddress))) {
        throw new BadRequestException('Devices in one booking must share the service option, address and appointment');
      }
      const deviceIds = dto.requests.map(r => r.deviceId).filter(Boolean);
      if (new Set(deviceIds).size !== deviceIds.length) throw new BadRequestException('The same saved device cannot appear twice in one booking');
      if (dto.offerId && dto.discountCode) throw new BadRequestException('Apply only one discount code');
      const categories = dto.requests.map(r => r.serviceCategory).filter(Boolean) as string[];
      let referralDiscountPercent = 0;
      let selectedOfferId: string | null = null;
      let referrerId: string | null = null;
      if (dto.discountCode) {
        const discount = await this.offers.validateCode(dto.discountCode, customer.id, categories, em);
        if (discount.kind === 'REFERRAL') {
          referralDiscountPercent = 10;
          referrerId = discount.referrerId;
        } else selectedOfferId = discount.offerId;
      } else if (dto.offerId) {
        await this.offers.validateForBooking(dto.offerId, customer.id, categories);
        selectedOfferId = dto.offerId;
      }
      const transportBase = dto.feePolicyVersion === '2026-10-02' ? 350 : 500;
      const transportTax = Math.round(transportBase * 0.18);
      const booking = await em.save(em.create(Booking, {
        id: dto.id, customerId: customer.id, reference: 'BKG-' + dto.id.replace(/-/g, '').slice(0, 16).toUpperCase(),
        serviceMode: mode, transportBase: mode === 'PICKUP' ? transportBase : 0,
        transportTax: mode === 'PICKUP' ? transportTax : 0, referralDiscountPercent, offerId: selectedOfferId, feePolicyVersion: dto.feePolicyVersion, acceptedAt: new Date(),
      }));
      if (selectedOfferId) await this.offers.claim(em, selectedOfferId, customer.id, booking.id);
      if (referralDiscountPercent) await em.update(User, customer.id, { referredByUserId: referrerId, referralDiscountUsedAt: new Date() });
      const requests: ServiceRequest[] = [];
      for (const item of dto.requests) {
        const { newDevice, ...request } = item;
        if (!request.serviceCategory) throw new BadRequestException('Choose a valid service');
        const definition = await this.catalog.get(request.serviceCategory);
        if (!definition) throw new BadRequestException('Choose a valid service');
        if (newDevice && request.deviceId) throw new BadRequestException('Choose a saved device or a new device, not both');
        if (definition.needsDevice && !request.deviceId && !newDevice) throw new BadRequestException('Device details are required');
        if (newDevice) {
          const device = await em.save(em.create(Device, { ...newDevice, customerId: customer.id }));
          request.deviceId = device.id;
        }
        const sr = await this.create(request, customer, em);
        sr.bookingId = booking.id;
        sr.bookingPosition = requests.length;
        await em.save(sr);
        requests.push(sr);
      }
      await this.delivery.planBooking(em, booking.id, requests.map(r => r.id));
      return { booking, requests, replay: false };
    });
    if (!result.replay) {
      const first = result.requests[0];
      await this.notificationsService.notifyAdmins(`New booking ${result.booking.reference}: ${result.requests.length} device/service request(s).`, first.id).catch(() => {});
      await this.notificationsService.triggerStatusNotification(first.status, customer, first.id, first.serviceRequestNumber, first.pickupSlotDate, first.serviceCategory).catch(() => {});
    }
    return { booking: result.booking, requests: result.requests };
  }

  async create(dto: CreateServiceRequestDto, customer: User, manager?: EntityManager) {
    const mode = dto.serviceMode || 'PICKUP';
    const initialStatus = mode === 'PICKUP' ? ServiceRequestStatus.PICKUP_SCHEDULED : ServiceRequestStatus.REQUEST_RECEIVED;
    const pickupAddress = serviceAddress(mode, dto.pickupAddress);
    if (dto.deviceId && !await (manager ?? this.dataSource).getRepository(Device).exists({ where: { id: dto.deviceId, customerId: customer.id } })) {
      throw new ForbiddenException('Device does not belong to your account');
    }
    if (dto.serviceCategory) {
      const today = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
      if (dto.pickupSlotDate < today) throw new BadRequestException('Choose today or a future appointment');
      const slots = await (manager ?? this.dataSource).getRepository(PickupSlot).find({where:{isActive:true}});
      if (!slots.some(s=>s.startTime+' - '+s.endTime===dto.pickupSlotTime)) throw new BadRequestException('This time slot is no longer available');
      const definition = await this.catalog.get(dto.serviceCategory);
      if (!definition || !definition.modes.includes(dto.serviceMode)) throw new BadRequestException('This service option is not available');
      if (dto.serviceCategory==='virus' && dto.serviceMode==='REMOTE' && dto.issues.some(i=>/ransomware|compromised/i.test(i.category))) throw new BadRequestException('Please choose carry-in or on-site assessment for this issue');
      if (dto.serviceCategory==='data' && dto.bookingAnswers?.dataRecoveryConsent!=='Accepted') throw new BadRequestException('Data recovery consent is required');
      if (!dto.termsAccepted || !['2026-08-31', '2026-10-02'].includes(dto.policyVersion ?? '')) throw new BadRequestException('Accept the current Terms and Privacy Policy');
      const answers = dto.bookingAnswers ?? {};
      if (Object.values(answers).some(v=>typeof v !== 'string' && !(Array.isArray(v)&&v.every(x=>typeof x==='string')))) throw new BadRequestException('Invalid service details');
      for (const field of definition.fields) {
        if (field.showWhen && !(Array.isArray(answers[field.showWhen.field]) ? answers[field.showWhen.field] as string[] : [answers[field.showWhen.field]]).some(v => field.showWhen.values.includes(v))) continue;
        const value = answers[field.id];
        if (field.required && (!value || (Array.isArray(value) ? !value.length : !value.trim()))) throw new BadRequestException(field.label + ' is required');
        if (value && field.type === 'number' && (!Number.isFinite(Number(value)) || Number(value) < 0)) throw new BadRequestException('Invalid ' + field.label);
        if (value && field.options && (Array.isArray(value) ? value : [value]).some(v => !field.options.includes(v))) throw new BadRequestException('Invalid ' + field.label);
      }
      if (JSON.stringify(answers).length > 20000) throw new BadRequestException('Service details are too long');
    }
    const persist = async (em: EntityManager) => {
      if (!manager) {
        const [active] = await em.query('SELECT is_active FROM users WHERE id = $1 FOR UPDATE', [customer.id]);
        if (!active?.is_active) throw new ForbiddenException('This account is no longer active');
      }
      const serviceRequestNumber = `VFX-${randomUUID().slice(0, 8).toUpperCase()}`;

      const sr = em.create(ServiceRequest, {
        ...dto,
        serviceMode: mode,
        pickupAddress,
        customerId: customer.id,
        serviceRequestNumber,
        consentedAt: dto.termsAccepted ? new Date() : undefined,
        status: initialStatus,
      });
      await em.save(sr);

      if (dto.issues?.length) {
        const issues = dto.issues.map((i) =>
          em.create(IssueSelection, { ...i, serviceRequestId: sr.id }),
        );
        await em.save(issues);
      }

      const history = em.create(StatusHistory, {
        serviceRequestId: sr.id,
        toStatus: initialStatus,
        changedById: customer.id,
        notes: 'Booking created',
      });
      await em.save(history);

      return sr;
    };
    if (manager) return persist(manager);
    return this.dataSource.transaction(persist).then(async (sr) => {
      await this.notificationsService.notifyAdmins(`New booking ${sr.serviceRequestNumber}: ${dto.serviceCategory ?? 'Repair'} (${dto.serviceMode ?? 'PICKUP'}).`, sr.id).catch(() => {});
      // Fire and forget — a notification failure should never fail the booking.
      await this.notificationsService
        .triggerStatusNotification(
          initialStatus,
          customer,
          sr.id,
          sr.serviceRequestNumber,
          sr.pickupSlotDate,
          sr.serviceCategory,
        )
        .catch(() => {});
      return sr;
    });
  }

  async findAll(filters: {
    status?: ServiceRequestStatus;
    customerId?: string;
    search?: string;
    limit?: number;
    page?: number;
  }, viewer?: User) {
    const limit = Math.min(filters.limit ?? 50, 200);
    const page  = Math.max(filters.page  ?? 1, 1);

    const qb = this.srRepo
      .createQueryBuilder('sr')
      .leftJoinAndSelect('sr.customer', 'customer')
      .leftJoinAndSelect('sr.device', 'device')
      .leftJoinAndSelect('sr.booking', 'booking')
      .leftJoinAndSelect('sr.issues', 'issues')
      .leftJoinAndSelect('sr.quoteItems', 'quoteItems')
      .leftJoinAndSelect('sr.assignedTechnician', 'technician')
      .orderBy('sr.createdAt', 'DESC')
      .take(limit)
      .skip((page - 1) * limit);

    if (filters.status) qb.andWhere('sr.status = :status', { status: filters.status });
    if (filters.customerId) qb.andWhere('sr.customerId = :cid', { cid: filters.customerId });
    if (viewer?.role === Role.TECHNICIAN) qb.andWhere('sr.assignedTechnicianId = :technicianId', { technicianId: viewer.id });
    if (filters.search) {
      qb.andWhere(
        '(sr.serviceRequestNumber ILIKE :search OR booking.reference ILIKE :search OR customer.name ILIKE :search OR customer.phone ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string, viewer?: User) {
    const sr = await this.srRepo.findOne({
      where: { id },
      relations: {
        customer: true,
        booking: true,
        device: true,
        issues: true,
        quoteItems: true,
        statusHistory: { changedBy: true },
        assignedTechnician: true,
      },
      order: {
        statusHistory: { timestamp: 'ASC' },
      },
    });
    if (!sr) throw new NotFoundException('Service request not found');
    if (viewer?.role === Role.CUSTOMER && sr.customerId !== viewer.id) throw new ForbiddenException();
    if (viewer?.role === Role.TECHNICIAN && sr.assignedTechnicianId !== viewer.id) throw new ForbiddenException('This request is not assigned to you');
    if (viewer?.role === Role.DELIVERY_AGENT) throw new ForbiddenException();
    if (viewer?.role === Role.CUSTOMER) sr.notes = '';
    if (sr.bookingId) {
      const siblings = await this.srRepo.find({ where: { bookingId: sr.bookingId, customerId: sr.customerId }, relations: { device: true }, order: { bookingPosition: 'ASC' } });
      (sr as any).relatedRequests = siblings.map(r => ({ id: r.id, serviceRequestNumber: r.serviceRequestNumber, serviceCategory: r.serviceCategory, status: r.status, device: r.device }));
    }
    return sr;
  }

  async findByCustomer(customerId: string) {
    return this.srRepo.find({
      where: { customerId },
      order: { createdAt: 'DESC' },
      relations: { device: true, issues: true, quoteItems: true, booking: true },
    });
  }

  async getHistory(id: string) {
    return this.historyRepo.find({
      where: { serviceRequestId: id },
      order: { timestamp: 'ASC' },
      relations: { changedBy: true },
    });
  }

  async getIssues(id: string) {
    return this.issueRepo.find({ where: { serviceRequestId: id } });
  }

  async updateStatus(id: string, dto: UpdateStatusDto, changedBy: User) {
    await this.dataSource.transaction(async em => {
      const sr = await em.findOne(ServiceRequest, {where:{id},lock:{mode:'pessimistic_write'}});
      if (!sr) throw new NotFoundException();
      if (changedBy.role === Role.TECHNICIAN && sr.assignedTechnicianId !== changedBy.id) throw new ForbiddenException('This request is not assigned to you');
      assertModeStatus(sr.serviceMode || 'PICKUP', dto.status);
      if (dto.status === ServiceRequestStatus.CANCELLED && !dto.notes?.trim()) throw new BadRequestException('A cancellation reason is required');
      if ([ServiceRequestStatus.UNDER_REPAIR,ServiceRequestStatus.TESTING].includes(dto.status) && !sr.quoteApproved) throw new BadRequestException('Customer approval is required before repair');
      if (!STATUS_TRANSITIONS[sr.status].includes(dto.status)) throw new BadRequestException('Cannot transition from '+sr.status+' to '+dto.status);
      const fromStatus=sr.status;
      sr.status=dto.status;
      await em.save(sr);
      await em.save(em.create(StatusHistory,{serviceRequestId:id,fromStatus,toStatus:dto.status,changedById:changedBy.id,notes:dto.notes}));
    });
    const sr=await this.findOne(id);
    await this.notificationsService.triggerStatusNotification(dto.status,sr.customer,id,sr.serviceRequestNumber,undefined,sr.serviceCategory).catch(()=>{});
    return sr;
  }

  async approveQuote(id: string, customerId: string, version?: number) {
    return this.decideQuote(id, customerId, true, '', version);
  }

  async collectByCustomer(id: string, receivedBy: string, changedBy: User) {
    if (![Role.SUPER_ADMIN, Role.OPERATIONS].includes(changedBy.role)) throw new ForbiddenException();
    const recipient = receivedBy.trim();
    if (!recipient || recipient.length > 120) throw new BadRequestException('Enter the name of the person collecting the device');
    await this.dataSource.transaction(async em => {
      const sr = await em.findOne(ServiceRequest, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!sr) throw new NotFoundException();
      if (sr.serviceMode && !['PICKUP', 'CARRY_IN'].includes(sr.serviceMode)) throw new BadRequestException('Customer collection is only available for workshop repairs');
      if (![ServiceRequestStatus.REPAIR_COMPLETE, ServiceRequestStatus.READY_FOR_HANDOVER].includes(sr.status)) throw new BadRequestException('The device must be ready for handover before customer collection');
      const fromStatus = sr.status;
      sr.status = ServiceRequestStatus.DELIVERED;
      sr.handoverMethod = 'CUSTOMER_COLLECTION';
      await em.save(sr);
      await em.save(em.create(StatusHistory, { serviceRequestId: id, fromStatus, toStatus: sr.status,
        changedById: changedBy.id, notes: 'Collected by customer. Received by: ' + recipient }));
    });
    const sr = await this.findOne(id);
    await this.notificationsService.notify(sr.customer, 'Your device has been collected from VfixurPC. Ticket ' + sr.serviceRequestNumber + '.', id).catch(() => {});
    return sr;
  }

  async rejectQuote(id: string, customerId: string, reason: string, version?: number, returnMethod = 'ORIGINAL_DELIVERY', returnAddress?: string) {
    return this.decideQuote(id, customerId, false, reason, version, returnMethod, returnAddress);
  }

  private async decideQuote(id: string, customerId: string, approved: boolean, reason: string, version?: number, returnMethod = 'ORIGINAL_DELIVERY', returnAddress?: string) {
    await this.dataSource.transaction(async em => {
      const sr = await em.findOne(ServiceRequest, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!sr) throw new NotFoundException();
      if (sr.customerId !== customerId) throw new ForbiddenException();
      if (sr.status !== ServiceRequestStatus.QUOTATION_SHARED) throw new BadRequestException('No pending quotation');
      if (sr.quoteVersion > 0 && version !== sr.quoteVersion) throw new BadRequestException('The quotation changed. Refresh it before responding.');
      const items = await em.find(QuoteItem, { where: { serviceRequestId: id } });
      if (!items.length) throw new BadRequestException('No quotation items');
      const fromStatus = sr.status;
      sr.quoteApproved = approved;
      sr.quoteRejectedReason = approved ? '' : reason.trim() || 'Return requested';
      sr.status = approved ? ServiceRequestStatus.QUOTE_APPROVED : ServiceRequestStatus.QUOTE_REJECTED;
      const booking = sr.bookingId ? await em.findOne(Booking, { where: { id: sr.bookingId } }) : null;
      sr.rejectionFeeTotal = !approved && booking?.feePolicyVersion === '2026-09-14' ? 590 : null;
      if (!approved) {
        if (sr.serviceMode === 'PICKUP') {
          if (returnMethod !== 'ORIGINAL_DELIVERY') throw new BadRequestException('This booking already includes return delivery');
          sr.handoverMethod = 'DELIVERY';
          sr.returnDeliveryFeeTotal = null;
        } else if (sr.serviceMode === 'CARRY_IN') {
          if (returnMethod === 'PAID_RETURN_DELIVERY') {
            if (!returnAddress?.trim()) throw new BadRequestException('Enter a return delivery address');
            assertInServiceArea(returnAddress);
            sr.handoverMethod = 'DELIVERY';
            sr.pickupAddress = returnAddress.trim();
            sr.returnDeliveryFeeTotal = booking?.feePolicyVersion === '2026-10-02' ? 413 : 590;
          } else if (returnMethod === 'CUSTOMER_COLLECTION') {
            sr.handoverMethod = 'CUSTOMER_COLLECTION';
            sr.returnDeliveryFeeTotal = null;
          } else throw new BadRequestException('Choose workshop collection or paid return delivery');
        }
      }
      sr.diagnosisFeeApplied = !approved && (sr.rejectionFeeTotal === 590 || items.some(i=>/diagnos/i.test(i.description)));
      const amount = items.reduce((sum,i)=>sum+Number(i.total)*(1+Number(i.taxRate)/100),0);
      sr.quoteArchive = [...(sr.quoteArchive ?? []), { version: sr.quoteVersion, items, amount,
        action: approved?'APPROVED':'REJECTED', actorId: customerId, timestamp: new Date().toISOString() }];
      await em.save(sr);
      await em.save(em.create(StatusHistory,{serviceRequestId:id,fromStatus,toStatus:sr.status,changedById:customerId,
        notes: 'Quote V'+sr.quoteVersion+' '+(approved?'approved':'rejected')+' by customer. Total INR '+amount.toFixed(2)}));
    });
    const sr = await this.findOne(id);
    await this.notificationsService.notifyAdmins((approved?'Quote approved: ':'Return requested: ')+sr.serviceRequestNumber+'.',id).catch(()=>{});
    await this.notificationsService.notify(sr.customer, approved?'Quotation approved. We will update you when work starts.':'Return requested. Our team will contact you.',id).catch(()=>{});
    return sr;
  }

  async assignTechnician(id: string, technicianId: string | null) {
    await this.srRepo.update(id, { assignedTechnicianId: technicianId } as any);
    return this.findOne(id);
  }

  async updateNotes(id: string, notes: string, changedBy: User) {
    const request = await this.srRepo.findOne({ where: { id } });
    if (!request) throw new NotFoundException();
    if (changedBy.role === Role.TECHNICIAN && request.assignedTechnicianId !== changedBy.id) throw new ForbiddenException('This request is not assigned to you');
    await this.srRepo.update(id, { notes } as any);
    return this.findOne(id);
  }
}
