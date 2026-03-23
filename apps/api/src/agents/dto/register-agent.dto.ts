import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RegisterAgentDto {
  @ApiProperty()
  @IsString()
  deviceId!: string;

  @ApiProperty({ default: '1.0.0' })
  @IsString()
  @IsOptional()
  version?: string;
}
