import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { AdminService, CreatePickupSlotDto } from './admin.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators';
import { Role } from '../common/enums';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private adminService: AdminService) {}

  // Dashboard
  @Get('dashboard')
  @Roles(Role.SUPER_ADMIN, Role.OPERATIONS)
  getDashboard() {
    return this.adminService.getDashboardStats();
  }

  // Analytics
  @Get('analytics/revenue')
  @Roles(Role.SUPER_ADMIN)
  getRevenue(@Query('from') from: string, @Query('to') to: string) {
    return this.adminService.getRevenueByDate(from, to);
  }

  // Pickup slots (public read, admin write)
  @Get('slots')
  @Roles(Role.SUPER_ADMIN, Role.OPERATIONS, Role.TECHNICIAN)
  getAllSlots() {
    return this.adminService.getAllSlots();
  }

  @Post('slots')
  @Roles(Role.SUPER_ADMIN)
  createSlot(@Body() dto: CreatePickupSlotDto) {
    return this.adminService.createSlot(dto);
  }

  @Post('slots/generate')
  @Roles(Role.SUPER_ADMIN)
  generateSlots(@Body() body?: { startHour?: number; endHour?: number; intervalMinutes?: number }) {
    return this.adminService.generateSlots(body);
  }

  @Patch('slots/:id')
  @Roles(Role.SUPER_ADMIN)
  updateSlot(@Param('id') id: string, @Body() dto: Partial<CreatePickupSlotDto>) {
    return this.adminService.updateSlot(id, dto);
  }

  @Delete('slots/:id')
  @Roles(Role.SUPER_ADMIN)
  deleteSlot(@Param('id') id: string) {
    return this.adminService.deleteSlot(id);
  }
}

// Public endpoint for customers to see active slots (no auth)
import { Controller as Ctrl, Get as G } from '@nestjs/common';

@Ctrl('pickup-slots')
export class PickupSlotsPublicController {
  constructor(private adminService: AdminService) {}

  @G()
  getActive() {
    return this.adminService.getSlots();
  }
}
