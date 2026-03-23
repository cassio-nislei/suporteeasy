import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ServiceStateDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ enum: ['running', 'stopped', 'degraded'] })
  @IsIn(['running', 'stopped', 'degraded'])
  status!: 'running' | 'stopped' | 'degraded';
}

export class AgentHeartbeatDto {
  @ApiProperty()
  @IsString()
  agentToken!: string;

  @ApiPropertyOptional({ enum: ['online', 'offline'] })
  @IsOptional()
  @IsIn(['online', 'offline'])
  status?: 'online' | 'offline';

  @ApiPropertyOptional({ type: [ServiceStateDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceStateDto)
  services?: ServiceStateDto[];
}
