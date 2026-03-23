import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class SchedulePatchDto {
  @ApiProperty()
  @IsDateString()
  scheduledAt!: string;
}
