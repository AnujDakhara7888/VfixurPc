import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'superadmin' })
  @IsString() @IsNotEmpty() @MaxLength(80)
  username: string;

  @ApiProperty({ example: 'Admin@1234' })
  @IsString() @IsNotEmpty() @MaxLength(72)
  password: string;
}
