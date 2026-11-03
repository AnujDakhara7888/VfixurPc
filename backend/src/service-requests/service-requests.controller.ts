import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { ServiceRequestsService } from './service-requests.service';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, CurrentUser } from '../common/decorators';
import { Role, ServiceRequestStatus } from '../common/enums';
import { User } from '../users/user.entity';
import { IsOptional, IsString, IsInt, Min, Length, IsIn, ValidateIf, MaxLength } from 'class-validator';

class RejectQuoteDto {
  @IsString() reason: string;
  @IsOptional() @IsInt() @Min(0) version?: number;
  @IsIn(['ORIGINAL_DELIVERY', 'CUSTOMER_COLLECTION', 'PAID_RETURN_DELIVERY']) returnMethod: string;
  @ValidateIf(dto => dto.returnMethod === 'PAID_RETURN_DELIVERY')
  @IsString() @Length(8, 500) returnAddress?: string;
}
class ApproveQuoteDto { @IsOptional() @IsInt() @Min(0) version?: number; }
class CustomerCollectionDto { @IsString() @Length(1, 120) receivedBy: string; }
class UpdateNotesDto { @IsString() @MaxLength(10000) notes: string; }

class AssignTechnicianDto {
  @IsOptional() @IsString() technicianId: string | null;
}

@Controller('service-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServiceRequestsController {
  constructor(private srService: ServiceRequestsService) {}

  @Post('bookings')
  @Roles(Role.CUSTOMER)
  createBooking(@Body() dto: CreateBookingDto, @CurrentUser() user: User) {
    return this.srService.createBooking(dto, user);
  }

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
    @CurrentUser() user?: User,
  ) {
    return this.srService.findAll({
      status,
      customerId,
      search,
      limit: limit ? Number(limit) : undefined,
      page: page ? Number(page) : undefined,
    }, user);
  }

  @Get('my')
  @Roles(Role.CUSTOMER)
  findMine(@CurrentUser() user: User) {
    return this.srService.findByCustomer(user.id);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.srService.findOne(id, user);
  }

  @Get(':id/history')
  async getHistory(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    await this.srService.findOne(id, user);
    return this.srService.getHistory(id);
  }

  @Get(':id/issues')
  async getIssues(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    await this.srService.findOne(id, user);
    return this.srService.getIssues(id);
  }

  @Patch(':id/status')
  @Roles(Role.SUPER_ADMIN, Role.TECHNICIAN, Role.OPERATIONS)
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: User,
  ) {
    return this.srService.updateStatus(id, dto, user);
  }

  @Patch(':id/approve-quote')
  @Roles(Role.CUSTOMER)
  approveQuote(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User, @Body() dto: ApproveQuoteDto) {
    return this.srService.approveQuote(id, user.id, dto.version);
  }

  @Post(':id/customer-collection')
  @Roles(Role.SUPER_ADMIN, Role.OPERATIONS)
  collect(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CustomerCollectionDto, @CurrentUser() user: User) {
    return this.srService.collectByCustomer(id, dto.receivedBy, user);
  }

  @Patch(':id/reject-quote')
  @Roles(Role.CUSTOMER)
  rejectQuote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectQuoteDto,
    @CurrentUser() user: User,
  ) {
    return this.srService.rejectQuote(id, user.id, dto.reason, dto.version, dto.returnMethod, dto.returnAddress);
  }

  @Patch(':id/assign')
  @Roles(Role.SUPER_ADMIN, Role.OPERATIONS)
  assignTechnician(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignTechnicianDto,
  ) {
    return this.srService.assignTechnician(id, dto.technicianId);
  }

  @Patch(':id/notes')
  @Roles(Role.SUPER_ADMIN, Role.TECHNICIAN, Role.OPERATIONS)
  updateNotes(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNotesDto,
    @CurrentUser() user: User,
  ) {
    return this.srService.updateNotes(id, dto.notes, user);
  }
}
