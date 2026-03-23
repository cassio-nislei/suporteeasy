import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ScriptParameterDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional({ default: 'string' })
  @IsOptional()
  @IsString()
  type?: string = 'string';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean = false;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultValue?: string;
}
