import { IsEmail, IsOptional, IsString, IsEnum } from 'class-validator';
import { Role } from '../../common/enums';

export class UpdateUserDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
}

export class UpdateRoleDto {
  @IsEnum(Role) role: Role;
}
