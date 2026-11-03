import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceRequestsService } from './service-requests.service';
import { ServiceRequestsController } from './service-requests.controller';
import { ServiceRequest } from './entities/service-request.entity';
import { StatusHistory } from './entities/status-history.entity';
import { IssueSelection } from './entities/issue-selection.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { CatalogModule } from '../catalog/catalog.module';
import { DeliveryModule } from '../delivery/delivery.module';
import { OffersModule } from '../offers/offers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ServiceRequest, StatusHistory, IssueSelection]),
    NotificationsModule,
    CatalogModule,
    DeliveryModule,
    OffersModule,
  ],
  providers: [ServiceRequestsService],
  controllers: [ServiceRequestsController],
  exports: [ServiceRequestsService],
})
export class ServiceRequestsModule {}
