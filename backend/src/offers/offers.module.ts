import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from '../notifications/notifications.module';
import { ServiceRequest } from '../service-requests/entities/service-request.entity';
import { User } from '../users/user.entity';
import { Offer, OfferClaim } from './offer.entity';
import { OffersController } from './offers.controller';
import { OffersService } from './offers.service';
import { WhatsAppService } from './whatsapp.service';

@Module({
  imports: [TypeOrmModule.forFeature([Offer, OfferClaim, User, ServiceRequest]), NotificationsModule],
  controllers: [OffersController], providers: [OffersService, WhatsAppService], exports: [OffersService, TypeOrmModule],
})
export class OffersModule {}
