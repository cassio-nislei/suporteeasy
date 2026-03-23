import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export class ReportScriptResultDto {
  @ApiProperty()
  @IsString()
  agentToken!: string;

  @ApiProperty()
  @IsString()
  executionId!: string;

  @ApiProperty({ enum: ['success', 'failed'] })
  @IsIn(['success', 'failed'])
  status!: 'success' | 'failed';

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  logs?: string[];

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  result?: Record<string, unknown>;
}
