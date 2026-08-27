import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ServiceRequestStatus } from '../../common/enums';

export class UpdateStatusDto {
  @ApiProperty({ enum: ServiceRequestStatus, example: ServiceRequestStatus.PICKED_UP })
  @IsEnum(ServiceRequestStatus)
  status: ServiceRequestStatus;

  @ApiPropertyOptional({ example: 'Picked up from customer address' })
  @IsOptional() @IsString()
  notes?: string;
}
