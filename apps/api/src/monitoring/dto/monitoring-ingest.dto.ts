import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

class MetricPayloadDto {
  @ApiProperty({ enum: ['cpu', 'ram', 'disk', 'service', 'custom'] })
  @IsIn(['cpu', 'ram', 'disk', 'service', 'custom'])
  type!: 'cpu' | 'ram' | 'disk' | 'service' | 'custom';

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  value!: number;

  @ApiProperty()
  @IsString()
  unit!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  timestamp?: string;
}

export class MonitoringIngestDto {
  @ApiProperty()
  @IsString()
  agentToken!: string;

  @ApiProperty({ type: [MetricPayloadDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MetricPayloadDto)
  metrics!: MetricPayloadDto[];
}
