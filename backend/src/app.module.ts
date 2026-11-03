import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';

import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DevicesModule } from './devices/devices.module';
import { ServiceRequestsModule } from './service-requests/service-requests.module';
import { QuotesModule } from './quotes/quotes.module';
import { PaymentsModule } from './payments/payments.module';
import { InvoicesModule } from './invoices/invoices.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DeliveryModule } from './delivery/delivery.module';
import { AdminModule } from './admin/admin.module';
import { FaqModule } from './faq/faq.module';

import { User } from './users/user.entity';
import { Device } from './devices/device.entity';
import { ServiceRequest } from './service-requests/entities/service-request.entity';
import { StatusHistory } from './service-requests/entities/status-history.entity';
import { IssueSelection } from './service-requests/entities/issue-selection.entity';
import { QuoteItem } from './quotes/quote-item.entity';
import { Payment } from './payments/payment.entity';
import { Invoice } from './invoices/invoice.entity';
import { Notification } from './notifications/notification.entity';
import { DeliveryAssignment } from './delivery/entities/delivery-assignment.entity';
import { ConditionPhoto } from './delivery/entities/condition-photo.entity';
import { FaqNode } from './faq/faq-node.entity';
import { PickupSlot } from './admin/pickup-slot.entity';
import { CatalogModule } from './catalog/catalog.module';
import { ServiceDefinition } from './catalog/service-definition.entity';
import { AttachmentsModule } from './attachments/attachments.module';
import { TicketAttachment } from './attachments/attachment.entity';
import { WebPushSubscription } from './notifications/web-push.entity';
import { PlacesModule } from './places/places.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { WarrantyModule } from './warranty/warranty.module';
import { RepairWarranty, WarrantyClaim } from './warranty/warranty.entities';
import { Booking } from './service-requests/entities/booking.entity';
import { BookingTransportTask } from './delivery/entities/booking-transport-task.entity';
import { OffersModule } from './offers/offers.module';
import { Offer, OfferClaim } from './offers/offer.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 40 }]),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [
          User, Device, Booking, BookingTransportTask, ServiceRequest, StatusHistory, IssueSelection, RepairWarranty, WarrantyClaim,
          QuoteItem, Payment, Invoice, Notification, WebPushSubscription,
          DeliveryAssignment, ConditionPhoto, FaqNode, PickupSlot, ServiceDefinition, TicketAttachment, Offer, OfferClaim,
        ],
        synchronize: config.get<string>('NODE_ENV') !== 'production',
        ssl: config.get<string>('DB_SSL', 'true') !== 'false',
        extra: config.get<string>('DB_SSL', 'true') === 'false' ? undefined : {
          ssl: { rejectUnauthorized: config.get<string>('DB_SSL_REJECT_UNAUTHORIZED', 'true') !== 'false' },
        },
      }),
    }),

    AuthModule,
    OffersModule,
    UsersModule,
    DevicesModule,
    ServiceRequestsModule,
    QuotesModule,
    PaymentsModule,
    InvoicesModule,
    NotificationsModule,
    DeliveryModule,
    AdminModule,
    FaqModule,
    CatalogModule,
    AttachmentsModule,
    PlacesModule,
    WarrantyModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: true,
        transform: true,
      }),
    },
  ],
})
export class AppModule {}
