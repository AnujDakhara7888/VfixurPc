import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class IssueSelectionDto {
  @ApiProperty({ example: 'Screen Issue' })
  @IsString() @IsNotEmpty() category: string;

  @ApiPropertyOptional({ example: 'Screen flickers when scrolling' })
  @IsOptional() @IsString() description?: string;
}

export class CreateServiceRequestDto {
  @ApiProperty({ example: 'uuid-of-device' })
  @IsUUID() deviceId: string;

  @ApiProperty({ type: [IssueSelectionDto], example: [{ category: 'Battery', description: 'Drains fast' }] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IssueSelectionDto)
  issues: IssueSelectionDto[];

  @ApiProperty({ example: '2026-06-10' })
  @IsDateString() pickupSlotDate: string;

  @ApiProperty({ example: '10:00 AM – 10:30 AM' })
  @IsString() @IsNotEmpty() pickupSlotTime: string;

  @ApiProperty({ example: 'Flat 4B, Sea View Apts, Bandra West, Mumbai 400050' })
  @IsString() @IsNotEmpty() pickupAddress: string;

  @ApiPropertyOptional({ example: 'Minor scratches on lid' })
  @IsOptional() @IsString() scratches?: string;

  @ApiPropertyOptional({ example: 'Small dent on corner' })
  @IsOptional() @IsString() dents?: string;

  @ApiPropertyOptional({ example: 'Stiff' })
  @IsOptional() @IsString() hingeCondition?: string;

  @ApiPropertyOptional({ example: 'Crack on bottom right' })
  @IsOptional() @IsString() screenCondition?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional() @IsBoolean() cameraWorking?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional() @IsBoolean() laptopStarting?: boolean;
}
