import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class SaveOfferDto {
  @IsString() @MaxLength(120) title: string;
  @IsString() @MaxLength(240) shortDescription: string;
  @IsIn(['PERCENTAGE', 'FIXED_DISCOUNT', 'FREE_ADD_ON', 'CONSULTATION']) offerType: string;
  @Type(() => Number) @IsNumber() @Min(0) discountValue: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(250) maximumDiscountCap: number;
  @Type(() => Number) @IsInt() @Min(0) minimumBillingAmount: number;
  @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) eligibleServiceCategories: string[];
  @IsIn(['ALL_CUSTOMERS', 'RETURNING_CUSTOMERS', 'INACTIVE_CUSTOMERS']) eligibleCustomerSegment: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(730) inactiveDays: number;
  @IsDateString() startAt: string;
  @IsDateString() expiresAt: string;
  @IsOptional() @IsString() @MaxLength(40) promoCode?: string;
  @IsBoolean() active: boolean;
  @Type(() => Number) @IsInt() @Min(1) @Max(20) usageLimitPerCustomer: number;
  @IsString() @MaxLength(200) deepLinkDestination: string;
  @IsString() @MaxLength(40) ctaLabel: string;
  @IsString() @MaxLength(100) pushTitle: string;
  @IsString() @MaxLength(220) pushBody: string;
  @IsOptional() @IsString() @MaxLength(120) whatsappTemplateName?: string;
  @IsOptional() @IsString() @MaxLength(12) whatsappLanguage?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) whatsappParameters?: string[];
}

export class SendCampaignDto {
  @IsArray() @ArrayMaxSize(2) @IsIn(['PUSH', 'WHATSAPP'], { each: true }) channels: ('PUSH' | 'WHATSAPP')[];
}

export class ValidateDiscountCodeDto {
  @IsString() @MaxLength(80) code: string;
  @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) serviceCategories: string[];
}
