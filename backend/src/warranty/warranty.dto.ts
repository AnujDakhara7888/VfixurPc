import { IsIn, IsString, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import type { ClaimStatus } from './warranty.entities';

export class SetWarrantyDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) startsOn: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) endsOn: string;
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Length(5, 4000) coverage: string;
}
export class RequestWarrantyDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Length(10, 2000) description: string;
}
export class ReviewWarrantyDto {
  @IsIn(['IN_PROGRESS', 'DECLINED', 'RESOLVED']) status: ClaimStatus;
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Length(5, 2000) note: string;
}
