import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Invoice } from './invoice.entity';
import { ServiceRequest } from '../service-requests/entities/service-request.entity';
import { User } from '../users/user.entity';
import { Role } from '../common/enums';
import { NotificationsService } from '../notifications/notifications.service';
@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice) private repo: Repository<Invoice>,
    @InjectRepository(ServiceRequest)
    private requests: Repository<ServiceRequest>,
    private notifications: NotificationsService,
    private config: ConfigService = new ConfigService(),
  ) {}
  async assertAccess(id: string, user: User) {
    const sr = await this.requests.findOne({
      where: { id },
      relations: { customer: true },
    });
    if (!sr) throw new NotFoundException('Service request not found');
    if (user.role === Role.CUSTOMER && sr.customerId !== user.id)
      throw new ForbiddenException();
    return sr;
  }
  async upload(
    srId: string,
    file: Express.Multer.File,
    number: string,
    kind: string,
    user: User,
  ) {
    if (![Role.SUPER_ADMIN, Role.OPERATIONS].includes(user.role)) throw new ForbiddenException();
    const sr = await this.assertAccess(srId, user);
    if (
      !file?.buffer ||
      file.size > 10 * 1024 * 1024 ||
      file.buffer.subarray(0, 5).toString() !== '%PDF-'
    ) {
      throw new BadRequestException('Upload a PDF, up to 10 MB');
    }
    if (
      !number?.trim() ||
      number.length > 100 ||
      !['Invoice', 'Receipt', 'Service report'].includes(kind)
    ) {
      throw new BadRequestException('Enter a document reference and type');
    }
    const saved = await this.repo.save(
      this.repo.create({
        serviceRequestId: srId,
        invoiceNumber: number.trim(),
        documentKind: kind,
        originalFilename: (file.originalname || number.trim() + '.pdf').slice(0, 255),
        uploadedBy: user.id,
        fileData: file.buffer,
        buyerName: sr.customer.name,
        taxableAmount: 0,
        totalAmount: 0,
        cgst: 0,
        sgst: 0,
      }),
    ).catch((error) => {
      const databaseCode = error?.driverError?.code ?? error?.cause?.code ?? error?.code;
      if (databaseCode === '23505' || /duplicate key value/i.test(String(error?.message ?? ''))) {
        throw new ConflictException('This document reference is already in use. Enter the unique invoice or receipt number printed on the PDF.');
      }
      throw error;
    });
    await this.notifications
      .notify(
        sr.customer,
        kind +
          ' uploaded for ' +
          sr.serviceRequestNumber +
          '. Open your ticket to download it.',
        sr.id,
      )
      .catch(() => {});
    const { fileData, ...metadata } = saved;
    return metadata;
  }
  async renderPdfById(id: string, user: User) {
    const invoice = await this.repo
      .createQueryBuilder('invoice')
      .addSelect('invoice.fileData')
      .where('invoice.id = :id', { id })
      .getOne();
    if (!invoice) throw new NotFoundException();
    await this.assertAccess(invoice.serviceRequestId, user);
    if (!invoice.fileData && invoice.pdfS3Url?.startsWith('s3://')) {
      const stored = new URL(invoice.pdfS3Url);
      if (stored.hostname === this.config.get('AWS_S3_BUCKET')) {
        const key = this.config.get<string>('AWS_ACCESS_KEY_ID');
        const client = new S3Client({ region: this.config.get('AWS_REGION','ap-south-1'),
          ...(key ? {credentials:{accessKeyId:key,secretAccessKey:this.config.get('AWS_SECRET_ACCESS_KEY','')}} : {}) });
        try {
          const result = await client.send(new GetObjectCommand({Bucket:stored.hostname,Key:stored.pathname.slice(1)}));
          if (result.Body) invoice.fileData = Buffer.from(await result.Body.transformToByteArray());
        } finally { client.destroy(); }
      }
    }
    if (!invoice.fileData)
      throw new NotFoundException(
        'This historical document must be uploaded by the office',
      );
    return {
      buffer: invoice.fileData,
      fileName: invoice.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_') + '.pdf',
    };
  }
  async findByServiceRequest(id: string, user: User) {
    await this.assertAccess(id, user);
    return this.repo.find({
      where: { serviceRequestId: id },
      order: { createdAt: 'DESC' },
    });
  }
  async findAll() {
    const rows = await this.repo.find({
      relations: { serviceRequest: true },
      order: { createdAt: 'DESC' },
    });
    return rows.map((i) => ({
      ...i,
      serviceRequest: {
        id: i.serviceRequestId,
        ticketNumber: i.serviceRequest?.serviceRequestNumber,
      },
      customer: { name: i.buyerName },
      subtotal: null,
      total: null,
    }));
  }
}
