import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { DeviceInventoryDto } from './common.dto';

export class CreateDeviceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiProperty()
  @IsString()
  hostname!: string;

  @ApiProperty()
  @IsString()
  ipAddress!: string;

  @ApiProperty()
  @IsString()
  os!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ type: DeviceInventoryDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DeviceInventoryDto)
  inventory?: DeviceInventoryDto;
}
