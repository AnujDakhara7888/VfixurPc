import {
  Controller, Post, Get, Param, Body, UseGuards, Headers, HttpCode, Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators';
import { Role } from '../common/enums';
import { IsBoolean, IsNumber, IsOptional } from 'class-validator';

class CreateOrderDto {
  @IsNumber() amount: number;
  @IsOptional() @IsBoolean() isAdvance?: boolean;
}

@Controller()
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Post('service-requests/:srId/payments/order')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER, Role.SUPER_ADMIN, Role.OPERATIONS)
  createOrder(@Param('srId') srId: string, @Body() dto: CreateOrderDto) {
    return this.paymentsService.createOrder({
      serviceRequestId: srId,
      amount: dto.amount,
      isAdvance: dto.isAdvance,
    });
  }

  @Get('service-requests/:srId/payments')
  @UseGuards(JwtAuthGuard)
  findPayments(@Param('srId') srId: string) {
    return this.paymentsService.findByServiceRequest(srId);
  }

  @Post('service-requests/:srId/payments/:paymentId/refund')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  refund(@Param('paymentId') paymentId: string) {
    return this.paymentsService.initiateRefund(paymentId);
  }

  @Post('webhooks/razorpay')
  @HttpCode(200)
  async razorpayWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) return { status: 'no body' };
    await this.paymentsService.verifyWebhook(rawBody, signature);
    const event = req.body as { event: string; payload: unknown };
    if (event.event === 'payment.captured') {
      await this.paymentsService.handlePaymentCaptured(event.payload);
    } else if (event.event === 'payment.failed') {
      await this.paymentsService.handlePaymentFailed(event.payload);
    }
    return { status: 'ok' };
  }
}
