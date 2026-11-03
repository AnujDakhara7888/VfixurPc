import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuotesService } from './quotes.service';
import { QuotesController } from './quotes.controller';
import { QuoteItem } from './quote-item.entity';
import { ServiceRequest } from '../service-requests/entities/service-request.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { Offer } from '../offers/offer.entity';

@Module({
  imports: [TypeOrmModule.forFeature([QuoteItem, ServiceRequest, Offer]), NotificationsModule],
  providers: [QuotesService],
  controllers: [QuotesController],
  exports: [QuotesService],
})
export class QuotesModule {}
