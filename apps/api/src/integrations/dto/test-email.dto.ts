import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class TestEmailDto {
  @ApiProperty()
  @IsEmail()
  to!: string;

  @ApiProperty()
  @IsString()
  subject!: string;

  @ApiProperty()
  @IsString()
  html!: string;
}
