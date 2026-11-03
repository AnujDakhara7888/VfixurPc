import { Controller, Get, Post, Body, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { CreateQuoteDto } from './dto/quote.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, CurrentUser } from '../common/decorators';
import { User } from '../users/user.entity';
import { Role } from '../common/enums';

@Controller('service-requests/:srId/quote')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuotesController {
  constructor(private quotesService: QuotesService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.OPERATIONS, Role.TECHNICIAN)
  create(@Param('srId', ParseUUIDPipe) srId: string, @Body() dto: CreateQuoteDto, @CurrentUser() user: User) {
    return this.quotesService.createQuote(srId, dto, user);
  }

  @Get()
  getQuote(@Param('srId', ParseUUIDPipe) srId: string, @CurrentUser() user: User) {
    return this.quotesService.getQuote(srId, user);
  }
}
