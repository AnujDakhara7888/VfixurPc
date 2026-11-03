import { Module, Controller, Get, Put, Post, Patch, Body, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WarrantyService } from './warranty.service';
import { RepairWarranty, WarrantyClaim } from './warranty.entities';
import { SetWarrantyDto, RequestWarrantyDto, ReviewWarrantyDto } from './warranty.dto';
import { NotificationsModule } from '../notifications/notifications.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, CurrentUser } from '../common/decorators';
import { Role } from '../common/enums';
import { User } from '../users/user.entity';

@Controller('service-requests/:id/warranty')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WarrantyController {
  constructor(private warranty: WarrantyService) {}
  @Get() @Roles(Role.CUSTOMER, Role.SUPER_ADMIN, Role.OPERATIONS, Role.TECHNICIAN)
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) { return this.warranty.get(id, user); }
  @Put() @Roles(Role.SUPER_ADMIN, Role.OPERATIONS)
  set(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetWarrantyDto, @CurrentUser() user: User) { return this.warranty.set(id, dto, user); }
  @Post('claims') @Roles(Role.CUSTOMER)
  request(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RequestWarrantyDto, @CurrentUser() user: User) { return this.warranty.request(id, dto, user); }
  @Patch('claims/:claimId') @Roles(Role.SUPER_ADMIN, Role.OPERATIONS)
  review(@Param('id', ParseUUIDPipe) id: string, @Param('claimId', ParseUUIDPipe) claimId: string, @Body() dto: ReviewWarrantyDto, @CurrentUser() user: User) { return this.warranty.review(id, claimId, dto, user); }
}

@Module({ imports: [TypeOrmModule.forFeature([RepairWarranty, WarrantyClaim]), NotificationsModule], controllers: [WarrantyController], providers: [WarrantyService] })
export class WarrantyModule {}
