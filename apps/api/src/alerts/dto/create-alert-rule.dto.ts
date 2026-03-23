import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import {
  AlertConditionOperator,
  AlertDeviceStatus,
  AlertRuleTargetType,
  AlertSeverity
} from '../alert-rule.schema';

export class AlertRuleConditionsDto {
  @ApiPropertyOptional({ description: 'Metric type for metric rules, e.g. cpu, disk, ram' })
  @IsOptional()
  @IsString()
  metricType?: string;

  @ApiPropertyOptional({ enum: AlertConditionOperator })
  @IsOptional()
  @IsIn([
    AlertConditionOperator.GT,
    AlertConditionOperator.GTE,
    AlertConditionOperator.LT,
    AlertConditionOperator.LTE,
    AlertConditionOperator.EQ,
    AlertConditionOperator.NEQ
  ])
  operator?: AlertConditionOperator;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  threshold?: number;

  @ApiPropertyOptional({ enum: AlertDeviceStatus })
  @IsOptional()
  @IsIn([AlertDeviceStatus.ONLINE, AlertDeviceStatus.OFFLINE, AlertDeviceStatus.UNKNOWN])
  status?: AlertDeviceStatus;
}

export class CreateAlertRuleDto {
  @ApiProperty()
  @IsString()
  @MaxLength(140)
  name!: string;

  @ApiProperty({ enum: AlertRuleTargetType })
  @IsIn([AlertRuleTargetType.METRIC, AlertRuleTargetType.DEVICE_STATUS])
  targetType!: AlertRuleTargetType;

  @ApiProperty({ type: AlertRuleConditionsDto })
  @ValidateNested()
  @Type(() => AlertRuleConditionsDto)
  conditions!: AlertRuleConditionsDto;

  @ApiProperty({ enum: AlertSeverity })
  @IsIn([AlertSeverity.CRITICAL, AlertSeverity.HIGH, AlertSeverity.MEDIUM, AlertSeverity.LOW])
  severity!: AlertSeverity;

  @ApiPropertyOptional({ default: 0, description: 'Cooldown in minutes' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  cooldown?: number = 0;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean = true;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  autoCreateTicket?: boolean = false;
}

