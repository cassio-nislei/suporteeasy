import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SimulatePatchScanDto {
  @ApiProperty()
  @IsString()
  deviceId!: string;

  @ApiProperty()
  @IsString()
  kbId!: string;

  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty({ default: 'medium' })
  @IsOptional()
  @IsString()
  severity?: string = 'medium';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  policyId?: string;
}
