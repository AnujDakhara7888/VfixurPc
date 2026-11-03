import {
  Controller, Post, Get, Param, Body, UseGuards, Headers, HttpCode, Req, ParseUUIDPipe, BadRequestException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser, Roles } from '../common/decorators';
import { Role } from '../common/enums';
import { IsBoolean, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { User } from '../users/user.entity';
import { SkipThrottle } from '@nestjs/throttler';

class CreateOrderDto {
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) @Max(10000000) amount: number;
  @IsOptional() @IsBoolean() isAdvance?: boolean;
}

@Controller()
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Post('service-requests/:srId/payments/order')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER, Role.SUPER_ADMIN, Role.OPERATIONS)
  createOrder(@Param('srId', ParseUUIDPipe) srId: string, @Body() dto: CreateOrderDto, @CurrentUser() user: User) {
    return this.paymentsService.createOrder({
      serviceRequestId: srId,
      amount: dto.amount,
      isAdvance: dto.isAdvance,
    }, user);
  }

  @Get('service-requests/:srId/payments')
  @UseGuards(JwtAuthGuard)
  findPayments(@Param('srId', ParseUUIDPipe) srId: string, @CurrentUser() user: User) {
    return this.paymentsService.findByServiceRequest(srId, user);
  }

  @Post('service-requests/:srId/payments/:paymentId/refund')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  refund(
    @Param('srId', ParseUUIDPipe) srId: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ) {
    return this.paymentsService.initiateRefund(srId, paymentId);
  }

  @Post('webhooks/razorpay')
  @SkipThrottle()
  @HttpCode(200)
  async razorpayWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) throw new BadRequestException('Webhook body is required');
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
