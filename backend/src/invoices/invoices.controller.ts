import { Controller, Post, Get, Param, Body, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { InvoicesService } from './invoices.service';
import { GenerateInvoiceDto } from './dto/generate-invoice.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators';
import { Role } from '../common/enums';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoicesController {
  constructor(private invoicesService: InvoicesService) {}

  @Post('service-requests/:srId/invoice/generate')
  @Roles(Role.SUPER_ADMIN, Role.OPERATIONS)
  generate(@Param('srId') srId: string, @Body() dto: GenerateInvoiceDto) {
    return this.invoicesService.generateAndStore(srId, dto);
  }

  @Get('service-requests/:srId/invoice')
  findBySr(@Param('srId') srId: string) {
    return this.invoicesService.findByServiceRequest(srId);
  }

  @Get('invoices')
  @Roles(Role.SUPER_ADMIN, Role.OPERATIONS)
  findAll() {
    return this.invoicesService.findAll();
  }

  @Get('invoices/:id/pdf')
  @Roles(Role.SUPER_ADMIN, Role.OPERATIONS)
  async downloadPdf(@Param('id') id: string, @Res() res: Response) {
    const { buffer, fileName } = await this.invoicesService.renderPdfById(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }
}
