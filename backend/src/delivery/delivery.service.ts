import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { DeliveryAssignment } from './entities/delivery-assignment.entity';
import { ConditionPhoto } from './entities/condition-photo.entity';
import { ServiceRequest } from '../service-requests/entities/service-request.entity';
import { StatusHistory } from '../service-requests/entities/status-history.entity';
import { AssignmentType, AssignmentStatus, PhotoType, ServiceRequestStatus, Role } from '../common/enums';
import { User } from '../users/user.entity';
import { randomUUID } from 'crypto';
import { TicketAttachment } from '../attachments/attachment.entity';
import { detectMedia } from '../attachments/attachments.module';
import { NotificationsService } from '../notifications/notifications.service';
import { BookingTransportTask } from './entities/booking-transport-task.entity';
import { AssignBookingTransportDto, CancelBookingTransportDto, CompleteBookingTransportDto } from './booking-transport.dto';
import { sameRequestIds, transportBlockers } from './booking-transport.rules';

interface CreateAssignmentDto {
  serviceRequestId: string;
  agentId: string;
  type: AssignmentType;
  scheduledDate: string;
  scheduledSlot: string;
}

const STORAGE_DIR = path.join(process.cwd(), 'storage', 'photos');
const EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic',
};

@Injectable()
export class DeliveryService {
  private readonly s3?: S3Client;
  private readonly bucket: string;

  constructor(
    @InjectRepository(DeliveryAssignment) private assignRepo: Repository<DeliveryAssignment>,
    @InjectRepository(ConditionPhoto) private photoRepo: Repository<ConditionPhoto>,
    @InjectRepository(ServiceRequest) private srRepo: Repository<ServiceRequest>,
    @InjectRepository(StatusHistory) private historyRepo: Repository<StatusHistory>,
    private config: ConfigService,
    @InjectRepository(TicketAttachment) private attachmentRepo: Repository<TicketAttachment>,
    private notifications: NotificationsService,
  ) {
    this.bucket = this.config.get<string>('AWS_S3_BUCKET', '');
    const key = this.config.get<string>('AWS_ACCESS_KEY_ID', '');
    if (this.bucket && key) {
      this.s3 = new S3Client({
        region: this.config.get<string>('AWS_REGION', 'ap-south-1'),
        credentials: { accessKeyId: key, secretAccessKey: this.config.get<string>('AWS_SECRET_ACCESS_KEY', '') },
      });
    }
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }

  private isStaffAdmin(role: Role) {
    return role === Role.SUPER_ADMIN || role === Role.OPERATIONS;
  }

  /** Call after saving every request, using the booking transaction's manager. */
  async planBooking(em: EntityManager, bookingId: string, requestIds: string[]): Promise<BookingTransportTask[]> {
    if (!em.queryRunner?.isTransactionActive) throw new BadRequestException('Booking transport must be planned inside the booking transaction');
    const ids = [...new Set(requestIds)].sort();
    if (!ids.length) throw new BadRequestException('A booking needs at least one request');
    const requests = await em.find(ServiceRequest, { where: { id: In(ids) } });
    if (requests.length !== ids.length || requests.some(request => (request as ServiceRequest & { bookingId?: string }).bookingId !== bookingId)) {
      throw new BadRequestException('Transport requests must belong to this booking');
    }
    const pickup = requests.filter(request => request.serviceMode === 'PICKUP');
    if (!pickup.length) return [];
    if (pickup.length !== requests.length) throw new BadRequestException('A transport booking cannot mix pickup and non-pickup requests');
    const repo = em.getRepository(BookingTransportTask);
    // The unique booking/direction constraint makes retries count once per group.
    await repo.createQueryBuilder().insert().values(
      (['PICKUP', 'RETURN'] as const).map(direction => ({ bookingId, requestIds: ids, direction, status: 'PLANNED' as const })),
    ).orIgnore().execute();
    const plans = await repo.find({ where: { bookingId }, order: { direction: 'ASC' } });
    if (plans.length !== 2 || plans.some(plan => [...plan.requestIds].sort().join(',') !== ids.join(','))) {
      throw new BadRequestException('Booking transport is already planned for different requests');
    }
    return plans;
  }

  async findBookingPlans(bookingId: string) {
    return this.assignRepo.manager.getRepository(BookingTransportTask).find({ where: { bookingId }, order: { direction: 'ASC' } });
  }

  async findPlannedBookings() {
    return this.assignRepo.manager.getRepository(BookingTransportTask).find({
      where: [{ status: 'PLANNED' }, { status: 'ASSIGNED' }], relations: { booking: true, agent: true },
      order: { createdAt: 'ASC' }, take: 200,
    });
  }

  async findAgentBookingPlans(agentId: string) {
    const plans = await this.assignRepo.manager.getRepository(BookingTransportTask).find({
      where: { agentId, status: 'ASSIGNED' },
      relations: { booking: true },
      order: { scheduledDate: 'ASC', createdAt: 'ASC' },
    });
    const requestIds = [...new Set(plans.flatMap(plan => plan.requestIds))];
    const requests = requestIds.length ? await this.srRepo.find({
      where: { id: In(requestIds) },
      relations: { customer: true, device: true },
    }) : [];
    const byId = new Map(requests.map(request => [request.id, request]));
    return plans.map(plan => ({
      ...plan,
      requests: plan.requestIds.map(id => byId.get(id)).filter(Boolean),
    }));
  }

  async assignBookingTransport(id: string, dto: AssignBookingTransportDto) {
    return this.assignRepo.manager.transaction(async em => {
      const repo = em.getRepository(BookingTransportTask);
      const plan = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!plan) throw new NotFoundException('Transport plan not found');
      if (plan.version !== dto.expectedVersion) throw new BadRequestException('Transport plan changed. Refresh and try again');
      if (!['PLANNED', 'ASSIGNED'].includes(plan.status)) throw new BadRequestException('Only an open transport plan can be assigned');
      const agent = await em.findOne(User, { where: { id: dto.agentId, isActive: true } });
      if (!agent || ![Role.DELIVERY_AGENT, Role.TECHNICIAN].includes(agent.role)) throw new BadRequestException('Choose an active delivery agent or technician');
      const requests = await em.find(ServiceRequest, { where: { id: In(plan.requestIds) } });
      const blockers = transportBlockers(plan, requests);
      // A return is assigned only once every device is ready; pickup can be scheduled at booking.
      if (blockers.length) throw new BadRequestException(blockers.join('; '));
      plan.agentId = agent.id; plan.scheduledDate = dto.scheduledDate;
      plan.scheduledSlot = dto.scheduledSlot.trim(); plan.status = 'ASSIGNED'; plan.version++;
      return repo.save(plan);
    });
  }

  async completeBookingTransport(id: string, dto: CompleteBookingTransportDto, user: User) {
    const completed = await this.assignRepo.manager.transaction(async em => {
      const repo = em.getRepository(BookingTransportTask);
      const plan = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!plan) throw new NotFoundException('Transport plan not found');
      if (plan.version !== dto.expectedVersion) throw new BadRequestException('Transport plan changed. Refresh and try again');
      if (plan.status === 'COMPLETED') return { plan, changed: [] as ServiceRequest[] };
      if (plan.status !== 'ASSIGNED') throw new BadRequestException('Assign this transport plan before completing it');
      if (user.id !== plan.agentId && !this.isStaffAdmin(user.role)) throw new ForbiddenException('Not your transport task');
      if (!sameRequestIds(plan.requestIds, dto.confirmedRequestIds)) throw new BadRequestException('Confirm every device in this booking');
      const requests = await em.find(ServiceRequest, { where: { id: In(plan.requestIds) }, lock: { mode: 'pessimistic_write' }, relations: { customer: true } });
      const blockers = transportBlockers(plan, requests);
      if (blockers.length) throw new BadRequestException(blockers.join('; '));
      const toStatus = plan.direction === 'PICKUP' ? ServiceRequestStatus.PICKED_UP : ServiceRequestStatus.DELIVERED;
      for (const request of requests) {
        const fromStatus = request.status;
        request.status = toStatus;
        if (plan.direction === 'RETURN') request.handoverMethod = 'DELIVERY';
        await em.save(request);
        await em.save(em.create(StatusHistory, { serviceRequestId: request.id, fromStatus, toStatus,
          changedById: user.id, notes: plan.direction === 'PICKUP' ? 'Device collected from customer' : 'Device delivered to ' + dto.receivedBy.trim() }));
      }
      plan.status = 'COMPLETED'; plan.completedAt = new Date(); plan.completedBy = user.id;
      plan.receivedBy = dto.receivedBy.trim(); plan.version++;
      await repo.save(plan);
      return { plan, changed: requests };
    });
    for (const request of completed.changed) {
      await this.notifications.triggerStatusNotification(request.status, request.customer, request.id, request.serviceRequestNumber, undefined, request.serviceCategory).catch(() => {});
    }
    return completed.plan;
  }

  async cancelBookingTransport(id: string, dto: CancelBookingTransportDto, user: User) {
    return this.assignRepo.manager.transaction(async em => {
      const repo = em.getRepository(BookingTransportTask);
      const plan = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!plan) throw new NotFoundException('Transport plan not found');
      if (plan.version !== dto.expectedVersion) throw new BadRequestException('Transport plan changed. Refresh and try again');
      if (plan.status === 'COMPLETED') throw new BadRequestException('Completed transport cannot be cancelled');
      plan.status = 'CANCELLED'; plan.cancelledAt = new Date(); plan.cancelledBy = user.id;
      plan.cancellationReason = dto.reason.trim(); plan.version++;
      return repo.save(plan);
    });
  }

  private async assertPickupRequest(id: string) {
    const sr = await this.srRepo.findOne({ where: { id } });
    if (!sr) throw new NotFoundException('Service request not found');
    // Legacy requests without a mode used pickup fulfilment.
    if (sr.serviceMode && sr.serviceMode !== 'PICKUP') {
      throw new BadRequestException('Pickup and delivery tasks are not available for this service option');
    }
    return sr;
  }

  // ── Assignments ────────────────────────────────────────────────────────
  async createAssignment(dto: CreateAssignmentDto) {
    await this.assertPickupRequest(dto.serviceRequestId);
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const assignment = this.assignRepo.create({ ...dto, otp, status: AssignmentStatus.PENDING });
    return this.assignRepo.save(assignment);
  }

  /** All assignments for one service request, with agent + photos — for the admin view. */
  async findByServiceRequest(serviceRequestId: string, user: User) {
    if (user.role === Role.TECHNICIAN) {
      const assigned = await this.srRepo.exists({ where: { id: serviceRequestId, assignedTechnicianId: user.id } });
      if (!assigned) throw new ForbiddenException('This request is not assigned to you');
    } else if (!this.isStaffAdmin(user.role)) throw new ForbiddenException();
    const assignments = await this.assignRepo.find({
      where: { serviceRequestId },
      relations: { agent: true },
      order: { createdAt: 'ASC' },
    });
    const withPhotos = await Promise.all(
      assignments.map(async (a) => ({
        ...a,
        agent: a.agent ? { id: a.agent.id, name: a.agent.name, phone: a.agent.phone } : null,
        otp: undefined,
        photos: await this.photoRepo.find({ where: { assignmentId: a.id }, order: { uploadedAt: 'ASC' } }),
      })),
    );
    return withPhotos;
  }

  async findAgentTasks(agentId: string) {
    const tasks = await this.assignRepo.find({
      where: [
        { agentId, status: AssignmentStatus.PENDING },
        { agentId, status: AssignmentStatus.IN_PROGRESS },
      ],
      relations: { serviceRequest: { customer: true, device: true } },
      order: { scheduledDate: 'ASC' },
    });
    return tasks.filter(task => task.serviceRequest && (!task.serviceRequest.serviceMode || task.serviceRequest.serviceMode === 'PICKUP'));
  }

  async findAgentHistory(agentId: string) {
    return this.assignRepo.find({
      where: { agentId, status: AssignmentStatus.COMPLETED },
      relations: { serviceRequest: true },
      order: { completedAt: 'DESC' },
      take: 50,
    });
  }

  async findOne(id: string, viewer?: User) {
    const a = await this.assignRepo.findOne({ where: { id }, relations: { serviceRequest: true, agent: true } });
    if (!a) throw new NotFoundException('Assignment not found');
    if (viewer) this.assertOwner(a, viewer);
    return a;
  }

  private assertOwner(a: DeliveryAssignment, user: User) {
    if (a.agentId !== user.id && !this.isStaffAdmin(user.role)) throw new ForbiddenException('Not your task');
  }

  // ── Status auto-advance ──────────────────────────────────────────────────
  private async advanceStatus(srId: string, to: ServiceRequestStatus, note: string, userId?: string) {
    const sr = await this.srRepo.findOne({ where: { id: srId }, relations: { customer: true } });
    if (!sr || sr.status === to) return;
    if (sr.serviceMode && sr.serviceMode !== 'PICKUP') throw new BadRequestException('This service option does not allow delivery status changes');
    if (to === ServiceRequestStatus.PICKED_UP && sr.status !== ServiceRequestStatus.PICKUP_SCHEDULED) return;
    if (to === ServiceRequestStatus.RECEIVED_AT_WORKSHOP && ![ServiceRequestStatus.PICKUP_SCHEDULED,ServiceRequestStatus.PICKED_UP].includes(sr.status)) return;
    if (to === ServiceRequestStatus.DELIVERED && ![ServiceRequestStatus.READY_FOR_HANDOVER, ServiceRequestStatus.OUT_FOR_DELIVERY].includes(sr.status)) {
      throw new BadRequestException('Request is not ready for delivery');
    }
    const from = sr.status;
    await this.srRepo.update(srId, { status: to });
    await this.historyRepo.save(this.historyRepo.create({
      serviceRequestId: srId, fromStatus: from, toStatus: to, notes: note, changedById: userId,
    }));
    await this.notifications.triggerStatusNotification(to, sr.customer, sr.id, sr.serviceRequestNumber, undefined, sr.serviceCategory).catch(()=>{});
  }

  // ── Photos (local storage; S3 mirror when configured) ────────────────────
  async uploadConditionPhoto(assignmentId: string, file: Express.Multer.File, photoType: PhotoType, user: User) {
    const assignment = await this.findOne(assignmentId);
    this.assertOwner(assignment, user);
    await this.assertPickupRequest(assignment.serviceRequestId);
    if (!file?.buffer) throw new BadRequestException('No image received');
    const mime = detectMedia(file.buffer);
    if (!mime?.startsWith('image/') || file.size > 20*1024*1024) throw new BadRequestException('Upload JPG, PNG or WebP up to 20 MB');
    if (!Object.values(PhotoType).includes(photoType)) throw new BadRequestException('Invalid photo type');

    const ext = EXT[mime] ?? 'jpg';
    const name = `${assignmentId}_${randomUUID()}.${ext}`;
    fs.writeFileSync(path.join(STORAGE_DIR, name), file.buffer);

    if (this.s3) {
      try {
        await this.s3.send(new PutObjectCommand({
          Bucket: this.bucket, Key: `condition-photos/${name}`, Body: file.buffer, ContentType: mime,
        }));
      } catch { /* local copy is the source of truth */ }
    }

    const photo = await this.photoRepo.save(this.photoRepo.create({ assignmentId, s3Url: name, type: photoType, fileData: file.buffer }));
    await this.attachmentRepo.save(this.attachmentRepo.create({ serviceRequestId: assignment.serviceRequestId, caption: photoType === PhotoType.WAREHOUSE ? 'Device received at our workshop' : photoType === PhotoType.PICKUP ? 'Device collected from customer' : 'Device handed back to customer', mime, uploadedBy: user.id, fileData: file.buffer }));

    // Warehouse photo means the device reached the workshop.
    if (photoType === PhotoType.WAREHOUSE) {
      await this.advanceStatus(assignment.serviceRequestId, ServiceRequestStatus.RECEIVED_AT_WORKSHOP, 'Device received at workshop', user.id);
    }
    const {fileData, ...metadata} = photo;
    return metadata;
  }

  async getPhotoFile(photoId: string, user: User): Promise<{ buffer: Buffer; mime: string }> {
    const photo = await this.photoRepo.createQueryBuilder('photo').addSelect('photo.fileData').where('photo.id = :id', {id:photoId}).getOne();
    if (!photo) throw new NotFoundException('Photo not found');
    await this.findOne(photo.assignmentId, user);
    if (photo.fileData) return {buffer:photo.fileData,mime:detectMedia(photo.fileData)??'image/jpeg'};
    const filePath = path.join(STORAGE_DIR, photo.s3Url);
    if (!fs.existsSync(filePath)) throw new NotFoundException('Image file missing');
    const ext = path.extname(filePath).slice(1);
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    return { buffer: fs.readFileSync(filePath), mime };
  }

  async getPhotos(assignmentId: string, user: User) {
    await this.findOne(assignmentId, user);
    return this.photoRepo.find({ where: { assignmentId }, order: { uploadedAt: 'ASC' } });
  }

  // ── Complete (proof-photo gated, OTP optional) ───────────────────────────
  async completeAssignment(assignmentId: string, user: User) {
    const a = await this.findOne(assignmentId);
    this.assertOwner(a, user);
    const sr = await this.assertPickupRequest(a.serviceRequestId);
    if (a.status === AssignmentStatus.COMPLETED) return a;
    if (a.status === AssignmentStatus.CANCELLED) throw new BadRequestException('Assignment cancelled');
    const allowed = a.type === AssignmentType.PICKUP
      ? [ServiceRequestStatus.PICKUP_SCHEDULED, ServiceRequestStatus.PICKED_UP, ServiceRequestStatus.RECEIVED_AT_WORKSHOP]
      : [ServiceRequestStatus.READY_FOR_HANDOVER, ServiceRequestStatus.OUT_FOR_DELIVERY, ServiceRequestStatus.DELIVERED];
    if (!allowed.includes(sr.status)) throw new BadRequestException('Request is not ready for this transport step');

    const proofType = a.type === AssignmentType.PICKUP ? PhotoType.PICKUP : PhotoType.DELIVERY;
    const proof = await this.photoRepo.count({ where: { assignmentId, type: proofType } });
    if (proof === 0) {
      throw new BadRequestException(`Upload a ${proofType.toLowerCase()} proof photo before completing`);
    }

    a.status = AssignmentStatus.COMPLETED;
    a.completedAt = new Date();
    await this.assignRepo.save(a);

    if (a.type === AssignmentType.PICKUP) {
      await this.advanceStatus(a.serviceRequestId, ServiceRequestStatus.PICKED_UP, 'Device picked up from customer', user.id);
    } else {
      await this.advanceStatus(a.serviceRequestId, ServiceRequestStatus.DELIVERED, 'Device delivered to customer', user.id);
    }
    return a;
  }

  async verifyOtp(assignmentId: string, otp: string, agent: User) {
    const assignment = await this.findOne(assignmentId);
    this.assertOwner(assignment, agent);
    await this.assertPickupRequest(assignment.serviceRequestId);
    if (assignment.otp !== otp) throw new BadRequestException('Invalid OTP');
    assignment.otpVerified = true;
    return this.assignRepo.save(assignment);
  }
}
