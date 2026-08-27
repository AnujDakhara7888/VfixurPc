import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class QuoteItemDto {
  @ApiPropertyOptional({ example: 'SSD', description: 'Short item name shown on the invoice' })
  @IsOptional() @IsString() itemName?: string;

  @ApiProperty({ example: 'Replace motherboard' })
  @IsString() description: string;

  @ApiPropertyOptional({ example: '998713', description: 'HSN (goods) / SAC (service) code' })
  @IsOptional() @IsString() hsnSac?: string;

  @ApiPropertyOptional({ example: 'PC', description: 'Unit of measure' })
  @IsOptional() @IsString() unit?: string;

  @ApiProperty({ example: 1 })
  @IsNumber() quantity: number;

  @ApiProperty({ example: 1500, description: 'Taxable (pre-GST) unit price' })
  @IsNumber() unitPrice: number;

  @ApiPropertyOptional({ example: 18, description: 'GST % — defaults to 18' })
  @IsOptional() @IsNumber() taxRate?: number;
}

export class CreateQuoteDto {
  @ApiProperty({ type: [QuoteItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  items: QuoteItemDto[];

  @ApiPropertyOptional({ example: false })
  @IsOptional() @IsBoolean()
  includeDiagnosisFee?: boolean;
}
