import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class RunScriptOnDeviceDto {
  @ApiProperty()
  @IsString()
  scriptId!: string;

  @ApiProperty()
  @IsString()
  deviceId!: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  parameters?: Record<string, string | number | boolean>;
}
