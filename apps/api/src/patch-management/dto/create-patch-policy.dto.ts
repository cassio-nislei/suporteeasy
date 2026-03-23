import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePatchPolicyDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string = '';

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @Type(() => String)
  @IsString({ each: true })
  targetTags?: string[] = [];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  maintenanceWindow?: string = '';

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  autoApprove?: boolean = false;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean = true;
}
