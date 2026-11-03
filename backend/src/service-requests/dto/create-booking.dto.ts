import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, Equals, IsArray, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { CreateServiceRequestDto } from './create-service-request.dto';

class BookingDeviceDto {
  @IsString() @IsNotEmpty() @MaxLength(100) brand: string;
  @IsString() @IsNotEmpty() @MaxLength(160) model: string;
  @IsOptional() @IsString() @MaxLength(160) serialNumber?: string;
}
export class BookingRequestDto extends CreateServiceRequestDto {
  @IsOptional() @ValidateNested() @Type(() => BookingDeviceDto) newDevice?: BookingDeviceDto;
}
export class CreateBookingDto {
  @IsUUID() id: string;
  @IsOptional() @IsUUID() offerId?: string;
  @IsOptional() @IsString() @MaxLength(80) discountCode?: string;
  @IsIn(['2026-09-14', '2026-10-02']) feePolicyVersion: string;
  @Equals(true) feesAccepted: boolean;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10)
  @ValidateNested({ each: true }) @Type(() => BookingRequestDto) requests: BookingRequestDto[];
}
