import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceRequestsService } from './service-requests.service';
import { ServiceRequestsController } from './service-requests.controller';
import { ServiceRequest } from './entities/service-request.entity';
import { StatusHistory } from './entities/status-history.entity';
import { IssueSelection } from './entities/issue-selection.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ServiceRequest, StatusHistory, IssueSelection])],
  providers: [ServiceRequestsService],
  controllers: [ServiceRequestsController],
  exports: [ServiceRequestsService],
})
export class ServiceRequestsModule {}
