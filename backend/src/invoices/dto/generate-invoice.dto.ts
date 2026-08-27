import { IsBoolean, IsOptional, IsString } from 'class-validator';

/** Optional buyer / billing overrides captured when an invoice is generated. */
export class GenerateInvoiceDto {
  @IsOptional() @IsString() buyerName?: string;
  @IsOptional() @IsString() buyerCompany?: string;
  @IsOptional() @IsString() buyerContact?: string;
  @IsOptional() @IsString() buyerPhone?: string;
  @IsOptional() @IsString() buyerEmail?: string;
  @IsOptional() @IsString() buyerGstin?: string;
  @IsOptional() @IsString() buyerPan?: string;
  @IsOptional() @IsString() billingAddress?: string;
  @IsOptional() @IsString() shippingAddress?: string;
  @IsOptional() @IsString() invoiceDate?: string; // ISO date (yyyy-mm-dd)
  @IsOptional() @IsString() dueDate?: string;
  @IsOptional() @IsBoolean() reverseCharge?: boolean;
}
