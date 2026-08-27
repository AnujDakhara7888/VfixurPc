import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateDeviceDto {
  @ApiProperty({ example: 'Apple' })
  @IsString() @IsNotEmpty() brand: string;

  @ApiProperty({ example: 'MacBook Pro 14' })
  @IsString() @IsNotEmpty() model: string;

  @ApiPropertyOptional({ example: 'C02XL2FHJGH5' })
  @IsOptional() @IsString() serialNumber?: string;

  @ApiPropertyOptional({ example: 'Good' })
  @IsOptional() @IsString() condition?: string;

  @ApiPropertyOptional({ example: { ram: '16GB', storage: '512GB SSD' } })
  @IsOptional() specs?: Record<string, unknown>;
}

export class UpdateDeviceDto {
  @ApiPropertyOptional({ example: 'Apple' })
  @IsOptional() @IsString() brand?: string;

  @ApiPropertyOptional({ example: 'MacBook Pro 14' })
  @IsOptional() @IsString() model?: string;

  @ApiPropertyOptional({ example: 'C02XL2FHJGH5' })
  @IsOptional() @IsString() serialNumber?: string;

  @ApiPropertyOptional({ example: 'Good' })
  @IsOptional() @IsString() condition?: string;

  @ApiPropertyOptional()
  @IsOptional() specs?: Record<string, unknown>;
}
