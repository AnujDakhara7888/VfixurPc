import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
import { v4 as uuidv4 } from 'uuid';

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

  // ── Assignments ────────────────────────────────────────────────────────
  async createAssignment(dto: CreateAssignmentDto) {
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const assignment = this.assignRepo.create({ ...dto, otp, status: AssignmentStatus.PENDING });
    return this.assignRepo.save(assignment);
  }

  /** All assignments for one service request, with agent + photos — for the admin view. */
  async findByServiceRequest(serviceRequestId: string) {
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
    return this.assignRepo.find({
      where: [
        { agentId, status: AssignmentStatus.PENDING },
        { agentId, status: AssignmentStatus.IN_PROGRESS },
      ],
      relations: { serviceRequest: { customer: true, device: true } },
      order: { scheduledDate: 'ASC' },
    });
  }

  async findAgentHistory(agentId: string) {
    return this.assignRepo.find({
      where: { agentId, status: AssignmentStatus.COMPLETED },
      relations: { serviceRequest: true },
      order: { completedAt: 'DESC' },
      take: 50,
    });
  }

  async findOne(id: string) {
    const a = await this.assignRepo.findOne({ where: { id }, relations: { serviceRequest: true, agent: true } });
    if (!a) throw new NotFoundException('Assignment not found');
    return a;
  }

  private assertOwner(a: DeliveryAssignment, user: User) {
    if (a.agentId !== user.id && !this.isStaffAdmin(user.role)) throw new ForbiddenException('Not your task');
  }

  // ── Status auto-advance ──────────────────────────────────────────────────
  private async advanceStatus(srId: string, to: ServiceRequestStatus, note: string, userId?: string) {
    const sr = await this.srRepo.findOne({ where: { id: srId } });
    if (!sr || sr.status === to) return;
    const from = sr.status;
    await this.srRepo.update(srId, { status: to });
    await this.historyRepo.save(this.historyRepo.create({
      serviceRequestId: srId, fromStatus: from, toStatus: to, notes: note, changedById: userId,
    }));
  }

  // ── Photos (local storage; S3 mirror when configured) ────────────────────
  async uploadConditionPhoto(assignmentId: string, file: Express.Multer.File, photoType: PhotoType, user: User) {
    const assignment = await this.findOne(assignmentId);
    this.assertOwner(assignment, user);
    if (!file?.buffer) throw new BadRequestException('No image received');

    const ext = EXT[file.mimetype] ?? 'jpg';
    const name = `${assignmentId}_${uuidv4()}.${ext}`;
    fs.writeFileSync(path.join(STORAGE_DIR, name), file.buffer);

    if (this.s3) {
      try {
        await this.s3.send(new PutObjectCommand({
          Bucket: this.bucket, Key: `condition-photos/${name}`, Body: file.buffer, ContentType: file.mimetype,
        }));
      } catch { /* local copy is the source of truth */ }
    }

    const photo = await this.photoRepo.save(this.photoRepo.create({ assignmentId, s3Url: name, type: photoType }));

    // Warehouse photo means the device reached the workshop.
    if (photoType === PhotoType.WAREHOUSE) {
      await this.advanceStatus(assignment.serviceRequestId, ServiceRequestStatus.RECEIVED_AT_WORKSHOP, 'Device received at workshop', user.id);
    }
    return photo;
  }

  async getPhotoFile(photoId: string): Promise<{ buffer: Buffer; mime: string }> {
    const photo = await this.photoRepo.findOne({ where: { id: photoId } });
    if (!photo) throw new NotFoundException('Photo not found');
    const filePath = path.join(STORAGE_DIR, photo.s3Url);
    if (!fs.existsSync(filePath)) throw new NotFoundException('Image file missing');
    const ext = path.extname(filePath).slice(1);
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    return { buffer: fs.readFileSync(filePath), mime };
  }

  async getPhotos(assignmentId: string) {
    return this.photoRepo.find({ where: { assignmentId }, order: { uploadedAt: 'ASC' } });
  }

  // ── Complete (proof-photo gated, OTP optional) ───────────────────────────
  async completeAssignment(assignmentId: string, user: User) {
    const a = await this.findOne(assignmentId);
    this.assertOwner(a, user);

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
    if (assignment.otp !== otp) throw new BadRequestException('Invalid OTP');
    assignment.otpVerified = true;
    return this.assignRepo.save(assignment);
  }
}
