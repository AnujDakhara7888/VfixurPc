import {
  Controller, Post, Get, Patch, Body, Param, UseGuards,
  UploadedFile, UseInterceptors, Query, Res,
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

  @Post('assignments')
  @Roles(Role.SUPER_ADMIN, Role.OPERATIONS)
  createAssignment(@Body() dto: CreateAssignmentDto) {
    return this.deliveryService.createAssignment(dto);
  }

  @Get('assignments/by-sr/:srId')
  @Roles(Role.SUPER_ADMIN, Role.OPERATIONS, Role.TECHNICIAN)
  byServiceRequest(@Param('srId') srId: string) {
    return this.deliveryService.findByServiceRequest(srId);
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
  findOne(@Param('id') id: string) {
    return this.deliveryService.findOne(id);
  }

  @Patch('assignments/:id/complete')
  @Roles(...FIELD)
  complete(@Param('id') id: string, @CurrentUser() user: User) {
    return this.deliveryService.completeAssignment(id, user);
  }

  @Post('assignments/:id/photos')
  @Roles(...FIELD)
  @UseInterceptors(FileInterceptor('file'))
  uploadPhoto(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('type') type: PhotoType,
    @CurrentUser() user: User,
  ) {
    return this.deliveryService.uploadConditionPhoto(id, file, type ?? PhotoType.PICKUP, user);
  }

  @Get('assignments/:id/photos')
  @Roles(...FIELD)
  getPhotos(@Param('id') id: string) {
    return this.deliveryService.getPhotos(id);
  }

  @Get('photos/:photoId/file')
  @Roles(...FIELD)
  async photoFile(@Param('photoId') photoId: string, @Res() res: Response) {
    const { buffer, mime } = await this.deliveryService.getPhotoFile(photoId);
    res.set({ 'Content-Type': mime, 'Cache-Control': 'private, max-age=3600' });
    res.end(buffer);
  }
}
