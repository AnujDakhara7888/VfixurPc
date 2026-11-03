import {
  Controller, Post, Get, Patch, Body, Param, UseGuards,
  UploadedFile, UseInterceptors, Query, Res, ParseUUIDPipe,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { DeliveryService } from './delivery.service';
import { AssignmentType, PhotoType, Role } from '../common/enums';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, CurrentUser } from '../common/decorators';
import { User } from '../users/user.entity';
import { IsEnum, IsString } from 'class-validator';
import { AssignBookingTransportDto, CancelBookingTransportDto, CompleteBookingTransportDto } from './booking-transport.dto';

// Roles allowed to perform field work (pickup / warehouse / delivery).
const FIELD = [Role.SUPER_ADMIN, Role.OPERATIONS, Role.TECHNICIAN, Role.DELIVERY_AGENT];

class CreateAssignmentDto {
  @IsString() serviceRequestId: string;
  @IsString() agentId: string;
  @IsEnum(AssignmentType) type: AssignmentType;
  @IsString() scheduledDate: string;
  @IsString() scheduledSlot: string;
}

@Controller('delivery')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DeliveryController {
  constructor(private deliveryService: DeliveryService) {}

  @Get('booking-plans')
  @Roles(Role.SUPER_ADMIN, Role.OPERATIONS)
  bookingPlans() {
    return this.deliveryService.findPlannedBookings();
  }

  @Get('booking-plans/my-tasks')
  @Roles(Role.TECHNICIAN, Role.DELIVERY_AGENT)
  myBookingPlans(@CurrentUser() user: User) {
    return this.deliveryService.findAgentBookingPlans(user.id);
  }

  @Get('bookings/:bookingId/plans')
  @Roles(Role.SUPER_ADMIN, Role.OPERATIONS)
  plansForBooking(@Param('bookingId', new ParseUUIDPipe()) bookingId: string) {
    return this.deliveryService.findBookingPlans(bookingId);
  }

  @Patch('booking-plans/:id/assign')
  @Roles(Role.SUPER_ADMIN, Role.OPERATIONS)
  assignBookingPlan(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignBookingTransportDto) {
    return this.deliveryService.assignBookingTransport(id, dto);
  }

  @Patch('booking-plans/:id/complete')
  @Roles(...FIELD)
  completeBookingPlan(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CompleteBookingTransportDto, @CurrentUser() user: User) {
    return this.deliveryService.completeBookingTransport(id, dto, user);
  }

  @Patch('booking-plans/:id/cancel')
  @Roles(Role.SUPER_ADMIN, Role.OPERATIONS)
  cancelBookingPlan(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelBookingTransportDto, @CurrentUser() user: User) {
    return this.deliveryService.cancelBookingTransport(id, dto, user);
  }

  @Post('assignments')
  @Roles(Role.SUPER_ADMIN, Role.OPERATIONS)
  createAssignment(@Body() dto: CreateAssignmentDto) {
    return this.deliveryService.createAssignment(dto);
  }

  @Get('assignments/by-sr/:srId')
  @Roles(Role.SUPER_ADMIN, Role.OPERATIONS, Role.TECHNICIAN)
  byServiceRequest(@Param('srId', ParseUUIDPipe) srId: string, @CurrentUser() user: User) {
    return this.deliveryService.findByServiceRequest(srId, user);
  }

  @Get('assignments/my-tasks')
  @Roles(Role.TECHNICIAN, Role.DELIVERY_AGENT)
  getMyTasks(@CurrentUser() user: User) {
    return this.deliveryService.findAgentTasks(user.id);
  }

  @Get('assignments/my-history')
  @Roles(Role.TECHNICIAN, Role.DELIVERY_AGENT)
  getMyHistory(@CurrentUser() user: User) {
    return this.deliveryService.findAgentHistory(user.id);
  }

  @Get('assignments/:id')
  @Roles(...FIELD)
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.deliveryService.findOne(id, user);
  }

  @Patch('assignments/:id/complete')
  @Roles(...FIELD)
  complete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.deliveryService.completeAssignment(id, user);
  }

  @Post('assignments/:id/photos')
  @Roles(...FIELD)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024, files: 1 } }))
  uploadPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('type') type: PhotoType,
    @CurrentUser() user: User,
  ) {
    return this.deliveryService.uploadConditionPhoto(id, file, type ?? PhotoType.PICKUP, user);
  }

  @Get('assignments/:id/photos')
  @Roles(...FIELD)
  getPhotos(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.deliveryService.getPhotos(id, user);
  }

  @Get('photos/:photoId/file')
  @Roles(...FIELD)
  async photoFile(@Param('photoId', ParseUUIDPipe) photoId: string, @CurrentUser() user: User, @Res() res: Response) {
    const { buffer, mime } = await this.deliveryService.getPhotoFile(photoId, user);
    res.set({ 'Content-Type': mime, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(buffer);
  }
}
