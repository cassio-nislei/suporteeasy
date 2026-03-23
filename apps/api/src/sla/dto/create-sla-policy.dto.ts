import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { SlaEscalationTrigger } from '../sla-policy.schema';

class SlaEscalationRuleDto {
  @ApiProperty({ enum: SlaEscalationTrigger })
  @IsIn([SlaEscalationTrigger.FIRST_RESPONSE, SlaEscalationTrigger.RESOLUTION])
  trigger!: SlaEscalationTrigger;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  afterMinutes!: number;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  action!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetRoleSlug?: string;
}

export class CreateSlaPolicyDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  firstResponseMinutes!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  resolutionMinutes!: number;

  @ApiPropertyOptional({ type: [SlaEscalationRuleDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SlaEscalationRuleDto)
  escalationRules?: SlaEscalationRuleDto[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean = true;
}

