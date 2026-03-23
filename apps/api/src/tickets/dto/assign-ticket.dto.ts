import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AssignTicketDto {
  @ApiPropertyOptional({ description: 'Use null/empty to unassign' })
  @IsOptional()
  @IsString()
  assigneeId?: string | null;
}

