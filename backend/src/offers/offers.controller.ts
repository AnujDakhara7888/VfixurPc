import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, Roles } from '../common/decorators';
import { Role } from '../common/enums';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { User } from '../users/user.entity';
import { SaveOfferDto, SendCampaignDto, ValidateDiscountCodeDto } from './offer.dto';
import { OffersService } from './offers.service';

@Controller('offers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OffersController {
  constructor(private service: OffersService) {}
  @Get() @Roles(Role.CUSTOMER) mine(@CurrentUser() user: User) { return this.service.eligibleFor(user); }
  @Get('admin') @Roles(Role.SUPER_ADMIN, Role.OPERATIONS) all() { return this.service.adminList(); }
  @Post('validate-code') @Roles(Role.CUSTOMER) validateCode(@Body() dto: ValidateDiscountCodeDto, @CurrentUser() user: User) {
    return this.service.validateCode(dto.code, user.id, dto.serviceCategories);
  }
  @Get(':id') @Roles(Role.CUSTOMER) one(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) { return this.service.getEligible(id, user); }
  @Post() @Roles(Role.SUPER_ADMIN, Role.OPERATIONS) create(@Body() dto: SaveOfferDto) { return this.service.save(dto); }
  @Patch(':id') @Roles(Role.SUPER_ADMIN, Role.OPERATIONS) update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveOfferDto) { return this.service.save(dto, id); }
  @Post(':id/send') @Roles(Role.SUPER_ADMIN) send(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SendCampaignDto) { return this.service.sendCampaign(id, dto.channels); }
}
