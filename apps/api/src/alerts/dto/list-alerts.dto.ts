import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { AlertSeverity } from '../alert-rule.schema';
import { AlertStatus } from '../alert.schema';

export class ListAlertsDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({ enum: AlertSeverity })
  @IsOptional()
  @IsIn([AlertSeverity.CRITICAL, AlertSeverity.HIGH, AlertSeverity.MEDIUM, AlertSeverity.LOW])
  severity?: AlertSeverity;

  @ApiPropertyOptional({ enum: AlertStatus })
  @IsOptional()
  @IsIn([AlertStatus.OPEN, AlertStatus.ACKNOWLEDGED, AlertStatus.RESOLVED])
  status?: AlertStatus;

  @ApiPropertyOptional({ default: 'createdAt', enum: ['createdAt', 'severity', 'status'] })
  @IsOptional()
  @IsIn(['createdAt', 'severity', 'status'])
  sortBy?: 'createdAt' | 'severity' | 'status' = 'createdAt';

  @ApiPropertyOptional({ default: 'desc', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

