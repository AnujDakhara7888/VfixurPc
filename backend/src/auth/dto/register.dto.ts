import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Anuj Dakhara' })
  @IsString() @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'anuj@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+919876543210', description: 'Must be +91 followed by 10 digits' })
  @IsString()
  @Matches(/^\+91[0-9]{10}$/, { message: 'Phone must be +91 followed by 10 digits' })
  phone: string;

  @ApiProperty({ example: 'anuj_d' })
  @IsString() @MinLength(3)
  username: string;

  @ApiProperty({ example: 'Password@123', minLength: 8 })
  @IsString() @MinLength(8)
  password: string;
}
