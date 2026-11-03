import { ArrayNotEmpty, ArrayUnique, IsArray, IsInt, IsString, IsUUID, Matches, MaxLength, Min, MinLength } from 'class-validator';

export class AssignBookingTransportDto {
  @IsInt() @Min(0) expectedVersion: number;
  @IsUUID() agentId: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) scheduledDate: string;
  @IsString() @MinLength(1) @MaxLength(80) scheduledSlot: string;
}

export class CompleteBookingTransportDto {
  @IsInt() @Min(0) expectedVersion: number;
  @IsString() @MinLength(1) @MaxLength(120) receivedBy: string;
  @IsArray() @ArrayNotEmpty() @ArrayUnique() @IsUUID('all', { each: true }) confirmedRequestIds: string[];
}

export class CancelBookingTransportDto {
  @IsInt() @Min(0) expectedVersion: number;
  @IsString() @MinLength(1) @MaxLength(500) reason: string;
}
