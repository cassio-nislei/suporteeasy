import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { AutomationActionType } from '../automation.schema';

class RetryPolicyDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  maxAttempts?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  backoffMs?: number;
}

export class AutomationActionDto {
  @ApiProperty({ enum: AutomationActionType })
  @IsEnum(AutomationActionType)
  type!: AutomationActionType;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class AutomationRetryPolicyDto extends RetryPolicyDto {}

export class BaseAutomationDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ enum: ['alert_created', 'device_offline', 'script_failed', 'ticket_created'] })
  @IsString()
  trigger!: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  conditions?: Record<string, unknown>;

  @ApiProperty({ type: [AutomationActionDto] })
  @ValidateNested({ each: true })
  @Type(() => AutomationActionDto)
  actions!: AutomationActionDto[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  enabled?: boolean;

  @ApiPropertyOptional({ type: RetryPolicyDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RetryPolicyDto)
  retryPolicy?: AutomationRetryPolicyDto;
}
