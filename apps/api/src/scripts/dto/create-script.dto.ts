import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested
} from 'class-validator';
import { ScriptPlatform } from '../script.schema';
import { ScriptParameterDto } from './script-parameter.dto';

export class CreateScriptDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: 'general' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ enum: ScriptPlatform })
  @IsEnum(ScriptPlatform)
  platform!: ScriptPlatform;

  @ApiProperty()
  @IsString()
  body!: string;

  @ApiPropertyOptional({ type: [ScriptParameterDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScriptParameterDto)
  parameters?: ScriptParameterDto[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
