import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { ReportQueryDto } from './report-query.dto';

export class TicketsByPeriodQueryDto extends ReportQueryDto {
  @ApiPropertyOptional({ enum: ['day', 'week'], default: 'day' })
  @IsOptional()
  @IsIn(['day', 'week'])
  groupBy?: 'day' | 'week' = 'day';
}
