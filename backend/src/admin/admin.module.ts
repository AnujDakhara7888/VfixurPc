import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { AdminController, PickupSlotsPublicController } from './admin.controller';
import { PickupSlot } from './pickup-slot.entity';
import { ServiceRequest } from '../service-requests/entities/service-request.entity';
import { Payment } from '../payments/payment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PickupSlot, ServiceRequest, Payment])],
  providers: [AdminService],
  controllers: [AdminController, PickupSlotsPublicController],
  exports: [AdminService],
})
export class AdminModule {}
