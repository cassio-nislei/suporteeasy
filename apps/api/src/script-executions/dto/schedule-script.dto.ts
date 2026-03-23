import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsObject, IsOptional, IsString, ValidateIf } from 'class-validator';

export class ScheduleScriptDto {
  @ApiProperty()
  @IsString()
  scriptId!: string;

  @ApiPropertyOptional({ description: 'Provide either deviceId or groupId' })
  @ValidateIf((value: ScheduleScriptDto) => !value.groupId)
  @IsString()
  @IsOptional()
  deviceId?: string;

  @ApiPropertyOptional({ description: 'Provide either groupId or deviceId' })
  @ValidateIf((value: ScheduleScriptDto) => !value.deviceId)
  @IsString()
  @IsOptional()
  groupId?: string;

  @ApiProperty({ description: 'ISO timestamp for scheduled run' })
  @IsDateString()
  runAt!: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  parameters?: Record<string, string | number | boolean>;
}
