import {
  IsEmail, IsNotEmpty, IsString, MinLength, Matches, IsIn,
} from 'class-validator';
import { Role } from '../../common/enums';

/** Roles an admin is allowed to assign when creating a staff member. */
export const STAFF_ROLES = [
  Role.TECHNICIAN,
  Role.OPERATIONS,
  Role.DELIVERY_AGENT,
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export class CreateStaffDto {
  @IsString() @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  // Tolerant: accepts spaces, dashes, an optional +91/91 prefix. The service
  // strips non-digits and keeps the last 10, then stores as +91XXXXXXXXXX.
  @IsString()
  @Matches(/^[0-9+\-\s()]{10,18}$/, {
    message: 'Enter a valid mobile number (at least 10 digits)',
  })
  phone: string;

  @IsString() @MinLength(3)
  username: string;

  @IsString() @MinLength(8)
  password: string;

  @IsIn(STAFF_ROLES as readonly Role[], {
    message: 'Role must be TECHNICIAN, OPERATIONS or DELIVERY_AGENT',
  })
  role: StaffRole;
}
