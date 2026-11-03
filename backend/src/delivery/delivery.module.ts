import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { DeliveryService } from './delivery.service';
import { DeliveryController } from './delivery.controller';
import { DeliveryAssignment } from './entities/delivery-assignment.entity';
import { ConditionPhoto } from './entities/condition-photo.entity';
import { ServiceRequest } from '../service-requests/entities/service-request.entity';
import { StatusHistory } from '../service-requests/entities/status-history.entity';
import { TicketAttachment } from '../attachments/attachment.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { BookingTransportTask } from './entities/booking-transport-task.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([DeliveryAssignment, ConditionPhoto, ServiceRequest, StatusHistory, TicketAttachment, BookingTransportTask]),
    NotificationsModule,
    MulterModule.register({ limits: { fileSize: 20 * 1024 * 1024, files: 1 } }),
  ],
  providers: [DeliveryService],
  controllers: [DeliveryController],
  exports: [DeliveryService],
})
export class DeliveryModule {}
