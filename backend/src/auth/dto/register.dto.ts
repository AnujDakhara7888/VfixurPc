import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEmail, IsNotEmpty, IsOptional, IsString, MinLength, Matches, MaxLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Anuj Dakhara' })
  @IsString() @IsNotEmpty() @MaxLength(120)
  name: string;

  @ApiProperty({ example: 'anuj@example.com' })
  @IsEmail() @MaxLength(254)
  email: string;

  @ApiProperty({ example: '+919876543210', description: 'Must be +91 followed by 10 digits' })
  @IsString()
  @Matches(/^\+91[0-9]{10}$/, { message: 'Phone must be +91 followed by 10 digits' })
  phone: string;

  @ApiProperty({ example: 'anuj_d' })
  @IsString() @MinLength(3) @MaxLength(80) @Matches(/^[a-zA-Z0-9_.-]+$/)
  username: string;

  @ApiProperty({ example: 'Password@123', minLength: 8 })
  @IsString() @MinLength(8) @MaxLength(72)
  password: string;

  @ApiProperty({ required: false, example: '1995-08-21' })
  @IsOptional() @IsDateString()
  dateOfBirth?: string;

  @ApiProperty({ required: false, example: 'friend_username', description: 'Existing customer username who referred this customer' })
  @IsOptional() @IsString() @MinLength(3) @MaxLength(80)
  referralUsername?: string;
}
