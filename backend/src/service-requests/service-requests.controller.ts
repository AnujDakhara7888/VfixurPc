import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ServiceRequestsService } from './service-requests.service';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, CurrentUser } from '../common/decorators';
import { Role, ServiceRequestStatus } from '../common/enums';
import { User } from '../users/user.entity';
import { IsOptional, IsString } from 'class-validator';

class RejectQuoteDto {
  @IsString() reason: string;
}

class AssignTechnicianDto {
  @IsOptional() @IsString() technicianId: string | null;
}

@Controller('service-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServiceRequestsController {
  constructor(private srService: ServiceRequestsService) {}

  @Post()
  @Roles(Role.CUSTOMER)
  create(@Body() dto: CreateServiceRequestDto, @CurrentUser() user: User) {
    return this.srService.create(dto, user);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.TECHNICIAN, Role.OPERATIONS)
  findAll(
    @Query('status') status?: ServiceRequestStatus,
    @Query('customerId') customerId?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    return this.srService.findAll({
      status,
      customerId,
      search,
      limit: limit ? Number(limit) : undefined,
      page: page ? Number(page) : undefined,
    });
  }

  @Get('my')
  @Roles(Role.CUSTOMER)
  findMine(@CurrentUser() user: User) {
    return this.srService.findByCustomer(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.srService.findOne(id);
  }

  @Get(':id/history')
  getHistory(@Param('id') id: string) {
    return this.srService.getHistory(id);
  }

  @Get(':id/issues')
  getIssues(@Param('id') id: string) {
    return this.srService.getIssues(id);
  }

  @Patch(':id/status')
  @Roles(Role.SUPER_ADMIN, Role.TECHNICIAN, Role.OPERATIONS, Role.DELIVERY_AGENT)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: User,
  ) {
    return this.srService.updateStatus(id, dto, user);
  }

  @Patch(':id/approve-quote')
  @Roles(Role.CUSTOMER)
  approveQuote(@Param('id') id: string, @CurrentUser() user: User) {
    return this.srService.approveQuote(id, user.id);
  }

  @Patch(':id/reject-quote')
  @Roles(Role.CUSTOMER)
  rejectQuote(
    @Param('id') id: string,
    @Body() dto: RejectQuoteDto,
    @CurrentUser() user: User,
  ) {
    return this.srService.rejectQuote(id, user.id, dto.reason);
  }

  @Patch(':id/assign')
  @Roles(Role.SUPER_ADMIN, Role.OPERATIONS)
  assignTechnician(
    @Param('id') id: string,
    @Body() dto: AssignTechnicianDto,
  ) {
    return this.srService.assignTechnician(id, dto.technicianId);
  }

  @Patch(':id/notes')
  @Roles(Role.SUPER_ADMIN, Role.TECHNICIAN, Role.OPERATIONS)
  updateNotes(
    @Param('id') id: string,
    @Body('notes') notes: string,
  ) {
    return this.srService.updateNotes(id, notes);
  }
}
