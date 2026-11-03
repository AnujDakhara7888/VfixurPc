import {
  Module,
  Controller,
  Get,
  Post,
  Param,
  Body,
  Res,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { TicketAttachment } from './attachment.entity';
import { ServiceRequest } from '../service-requests/entities/service-request.entity';
import { User } from '../users/user.entity';
import { Role } from '../common/enums';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators';
import { NotificationsModule } from '../notifications/notifications.module';
import { NotificationsService } from '../notifications/notifications.service';

export function detectMedia(buffer: Buffer): string | undefined {
  if (buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255])))
    return 'image/jpeg';
  if (
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return 'image/png';
  if (
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  )
    return 'image/webp';
  if (
    buffer.toString('ascii', 4, 8) === 'ftyp' &&
    ['isom', 'mp42', 'mp41', 'avc1', 'M4V '].includes(
      buffer.toString('ascii', 8, 12),
    )
  )
    return 'video/mp4';
}
@Injectable()
export class AttachmentsService {
  constructor(
    @InjectRepository(TicketAttachment)
    private repo: Repository<TicketAttachment>,
    @InjectRepository(ServiceRequest)
    private requests: Repository<ServiceRequest>,
    private notifications: NotificationsService,
  ) {}
  async access(id: string, user: User) {
    const sr = await this.requests.findOne({
      where: { id },
      relations: { customer: true },
    });
    if (!sr) throw new NotFoundException();
    if (user.role === Role.CUSTOMER && sr.customerId !== user.id)
      throw new ForbiddenException();
    if (user.role === Role.TECHNICIAN && sr.assignedTechnicianId !== user.id)
      throw new ForbiddenException('This request is not assigned to you');
    if (user.role === Role.DELIVERY_AGENT) throw new ForbiddenException();
    return sr;
  }
  async list(id: string, user: User) {
    await this.access(id, user);
    return this.repo.find({
      where: { serviceRequestId: id },
      order: { createdAt: 'DESC' },
    });
  }
  async upload(
    id: string,
    file: Express.Multer.File,
    caption: string,
    user: User,
  ) {
    const sr = await this.access(id, user);
    const mime = file?.buffer && detectMedia(file.buffer);
    if (!mime || file.size > 20 * 1024 * 1024)
      throw new BadRequestException('Upload JPG, PNG, WebP or MP4 up to 20 MB');
    const saved = await this.repo.manager.transaction(async em => {
      // Use the deletion lock even for staff uploads: unrelated ticket media must
      // not be recreated after anonymisation. Condition evidence has its own flow.
      const [customer] = await em.query('SELECT is_active FROM users WHERE id = $1 FOR UPDATE', [sr.customerId]);
      if (!customer?.is_active) throw new ForbiddenException('This customer account is no longer active');
      const attachments = em.getRepository(TicketAttachment);
      if ((await attachments.count({ where: { serviceRequestId: id } })) >= 30)
        throw new BadRequestException('Maximum 30 attachments per ticket');
      return attachments.save(attachments.create({
        serviceRequestId: id,
        caption: (caption || 'Device update').slice(0, 500),
        mime,
        uploadedBy: user.id,
        fileData: file.buffer,
      }));
    });
    if (user.role === Role.CUSTOMER)
      await this.notifications.notifyAdmins('Customer uploaded a photo or video for ' + sr.serviceRequestNumber + '.', sr.id).catch(() => {});
    else
      await this.notifications
        .notify(
          sr.customer,
          'New workshop photo or video for ' + sr.serviceRequestNumber + '.',
          sr.id,
        )
        .catch(() => {});
    const { fileData, ...metadata } = saved;
    return metadata;
  }
  async file(id: string, user: User) {
    const file = await this.repo
      .createQueryBuilder('file')
      .addSelect('file.fileData')
      .where('file.id = :id', { id })
      .getOne();
    if (!file) throw new NotFoundException();
    await this.access(file.serviceRequestId, user);
    return file;
  }
}
@Controller()
@UseGuards(JwtAuthGuard)
export class AttachmentsController {
  constructor(private service: AttachmentsService) {}
  @Get('service-requests/:id/attachments')
  list(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.list(id, user);
  }
  @Post('service-requests/:id/attachments')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }),
  )
  upload(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('caption') caption: string,
    @CurrentUser() user: User,
  ) {
    return this.service.upload(id, file, caption, user);
  }
  @Get('attachments/:id/file')
  async file(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Res() res: Response,
  ) {
    const file = await this.service.file(id, user);
    res.set({
      'Content-Type': file.mime,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(file.fileData);
  }
}
@Module({
  imports: [
    TypeOrmModule.forFeature([TicketAttachment, ServiceRequest]),
    NotificationsModule,
  ],
  providers: [AttachmentsService],
  controllers: [AttachmentsController],
})
export class AttachmentsModule {}
