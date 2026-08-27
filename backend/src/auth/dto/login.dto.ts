import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'superadmin' })
  @IsString() @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'Admin@1234' })
  @IsString() @IsNotEmpty()
  password: string;
}
