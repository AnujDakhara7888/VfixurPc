import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Res,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  ParseUUIDPipe,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { InvoicesService } from './invoices.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, CurrentUser } from '../common/decorators';
import { Role } from '../common/enums';
import { User } from '../users/user.entity';
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoicesController {
  constructor(private service: InvoicesService) {}
  @Post('service-requests/:srId/invoice/upload')
  @Roles(Role.SUPER_ADMIN, Role.OPERATIONS)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  upload(
    @Param('srId', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('invoiceNumber') number: string,
    @Body('documentKind') kind: string,
    @CurrentUser() user: User,
  ) {
    return this.service.upload(id, file, number, kind, user);
  }
  @Get('service-requests/:srId/invoice')
  find(@Param('srId', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.findByServiceRequest(id, user);
  }
  @Get('invoices')
  @Roles(Role.SUPER_ADMIN, Role.OPERATIONS)
  list() {
    return this.service.findAll();
  }
  @Get('invoices/:id/pdf')
  @Roles(Role.CUSTOMER, Role.SUPER_ADMIN, Role.OPERATIONS)
  async file(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Res() res: Response,
  ) {
    const { buffer, fileName } = await this.service.renderPdfById(id, user);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="' + fileName + '"',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(buffer);
  }
}
