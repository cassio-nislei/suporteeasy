import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested
} from 'class-validator';
import { AutomationTrigger } from '../automation.schema';
import { AutomationActionDto, AutomationRetryPolicyDto } from './automation-action.dto';

export class CreateAutomationDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ enum: AutomationTrigger })
  @IsEnum(AutomationTrigger)
  trigger!: AutomationTrigger;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  conditions?: Record<string, unknown>;

  @ApiProperty({ type: [AutomationActionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AutomationActionDto)
  actions!: AutomationActionDto[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ type: AutomationRetryPolicyDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AutomationRetryPolicyDto)
  retryPolicy?: AutomationRetryPolicyDto;
}
