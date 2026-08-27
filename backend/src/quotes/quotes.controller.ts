import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { CreateQuoteDto } from './dto/quote.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators';
import { Role } from '../common/enums';

@Controller('service-requests/:srId/quote')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuotesController {
  constructor(private quotesService: QuotesService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.TECHNICIAN)
  create(@Param('srId') srId: string, @Body() dto: CreateQuoteDto) {
    return this.quotesService.createQuote(srId, dto);
  }

  @Get()
  getQuote(@Param('srId') srId: string) {
    return this.quotesService.getQuote(srId);
  }
}
