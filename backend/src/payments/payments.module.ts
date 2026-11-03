import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { Payment } from './payment.entity';
import { ServiceRequest } from '../service-requests/entities/service-request.entity';
import { QuoteItem } from '../quotes/quote-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, ServiceRequest, QuoteItem])],
  providers: [PaymentsService],
  controllers: [PaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
