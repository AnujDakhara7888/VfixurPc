import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ServiceRequest } from './entities/service-request.entity';
import { StatusHistory } from './entities/status-history.entity';
import { IssueSelection } from './entities/issue-selection.entity';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { ServiceRequestStatus } from '../common/enums';
import { User } from '../users/user.entity';

const STATUS_TRANSITIONS: Record<ServiceRequestStatus, ServiceRequestStatus[]> = {
  [ServiceRequestStatus.PICKUP_SCHEDULED]: [ServiceRequestStatus.PICKED_UP],
  [ServiceRequestStatus.PICKED_UP]: [ServiceRequestStatus.RECEIVED_AT_WORKSHOP],
  [ServiceRequestStatus.RECEIVED_AT_WORKSHOP]: [ServiceRequestStatus.DIAGNOSED],
  [ServiceRequestStatus.DIAGNOSED]: [ServiceRequestStatus.QUOTATION_SHARED],
  [ServiceRequestStatus.QUOTATION_SHARED]: [
    ServiceRequestStatus.PAYMENT_RECEIVED,
    ServiceRequestStatus.UNDER_REPAIR,
  ],
  [ServiceRequestStatus.PAYMENT_RECEIVED]: [ServiceRequestStatus.UNDER_REPAIR],
  [ServiceRequestStatus.UNDER_REPAIR]: [ServiceRequestStatus.REPAIR_COMPLETE],
  [ServiceRequestStatus.REPAIR_COMPLETE]: [ServiceRequestStatus.OUT_FOR_DELIVERY],
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
  ) {}

  async create(dto: CreateServiceRequestDto, customer: User) {
    return this.dataSource.transaction(async (em) => {
      const count = await em.count(ServiceRequest);
      const serviceRequestNumber = `VFX-${String(count + 1).padStart(4, '0')}`;

      const sr = em.create(ServiceRequest, {
        ...dto,
        customerId: customer.id,
        serviceRequestNumber,
        status: ServiceRequestStatus.PICKUP_SCHEDULED,
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
        toStatus: ServiceRequestStatus.PICKUP_SCHEDULED,
        changedById: customer.id,
        notes: 'Booking created',
      });
      await em.save(history);

      return sr;
    });
  }

  async findAll(filters: {
    status?: ServiceRequestStatus;
    customerId?: string;
    search?: string;
    limit?: number;
    page?: number;
  }) {
    const limit = Math.min(filters.limit ?? 50, 200);
    const page  = Math.max(filters.page  ?? 1, 1);

    const qb = this.srRepo
      .createQueryBuilder('sr')
      .leftJoinAndSelect('sr.customer', 'customer')
      .leftJoinAndSelect('sr.device', 'device')
      .leftJoinAndSelect('sr.issues', 'issues')
      .leftJoinAndSelect('sr.quoteItems', 'quoteItems')
      .leftJoinAndSelect('sr.assignedTechnician', 'technician')
      .orderBy('sr.createdAt', 'DESC')
      .take(limit)
      .skip((page - 1) * limit);

    if (filters.status) qb.andWhere('sr.status = :status', { status: filters.status });
    if (filters.customerId) qb.andWhere('sr.customerId = :cid', { cid: filters.customerId });
    if (filters.search) {
      qb.andWhere(
        '(sr.serviceRequestNumber ILIKE :search OR customer.name ILIKE :search OR customer.phone ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const sr = await this.srRepo.findOne({
      where: { id },
      relations: {
        customer: true,
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
    return sr;
  }

  async findByCustomer(customerId: string) {
    return this.srRepo.find({
      where: { customerId },
      order: { createdAt: 'DESC' },
      relations: { device: true, issues: true, quoteItems: true },
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
    const sr = await this.findOne(id);

    const allowed = STATUS_TRANSITIONS[sr.status];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition from ${sr.status} to ${dto.status}`,
      );
    }

    const fromStatus = sr.status;
    sr.status = dto.status;
    await this.srRepo.save(sr);

    const history = this.historyRepo.create({
      serviceRequestId: id,
      fromStatus,
      toStatus: dto.status,
      changedById: changedBy.id,
      notes: dto.notes,
    });
    await this.historyRepo.save(history);

    return sr;
  }

  async approveQuote(id: string, customerId: string) {
    const sr = await this.findOne(id);
    if (sr.customerId !== customerId) throw new ForbiddenException();
    if (sr.status !== ServiceRequestStatus.QUOTATION_SHARED) {
      throw new BadRequestException('No pending quote to approve');
    }
    const fromStatus = sr.status;
    sr.quoteApproved = true;
    sr.status = ServiceRequestStatus.UNDER_REPAIR;
    await this.srRepo.save(sr);

    const history = this.historyRepo.create({
      serviceRequestId: id,
      fromStatus,
      toStatus: sr.status,
      changedById: customerId,
      notes: 'Quote approved by customer',
    });
    await this.historyRepo.save(history);

    return this.findOne(id);
  }

  async rejectQuote(id: string, customerId: string, reason: string) {
    const sr = await this.findOne(id);
    if (sr.customerId !== customerId) throw new ForbiddenException();
    sr.quoteRejectedReason = reason;
    sr.diagnosisFeeApplied = true;
    await this.srRepo.save(sr);

    const history = this.historyRepo.create({
      serviceRequestId: id,
      fromStatus: sr.status,
      toStatus: sr.status,
      changedById: customerId,
      notes: `Quote rejected: ${reason}`,
    });
    await this.historyRepo.save(history);

    return this.findOne(id);
  }

  async assignTechnician(id: string, technicianId: string | null) {
    await this.srRepo.update(id, { assignedTechnicianId: technicianId } as any);
    return this.findOne(id);
  }

  async updateNotes(id: string, notes: string) {
    await this.srRepo.update(id, { notes } as any);
    return this.findOne(id);
  }
}
