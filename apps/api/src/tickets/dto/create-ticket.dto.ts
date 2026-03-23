import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { TicketPriority, TicketSource, TicketStatus } from '../ticket.schema';

export class CreateTicketDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({ enum: TicketSource, default: TicketSource.MANUAL })
  @IsOptional()
  @IsIn([TicketSource.MANUAL, TicketSource.ALERT, TicketSource.AUTOMATION])
  source?: TicketSource = TicketSource.MANUAL;

  @ApiProperty()
  @IsString()
  @MaxLength(180)
  subject!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(4000)
  description!: string;

  @ApiPropertyOptional({ enum: TicketStatus, default: TicketStatus.OPEN })
  @IsOptional()
  @IsIn([
    TicketStatus.OPEN,
    TicketStatus.IN_PROGRESS,
    TicketStatus.RESOLVED,
    TicketStatus.CLOSED,
    TicketStatus.REOPENED
  ])
  status?: TicketStatus = TicketStatus.OPEN;

  @ApiPropertyOptional({ enum: TicketPriority, default: TicketPriority.MEDIUM })
  @IsOptional()
  @IsIn([TicketPriority.LOW, TicketPriority.MEDIUM, TicketPriority.HIGH, TicketPriority.URGENT])
  priority?: TicketPriority = TicketPriority.MEDIUM;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assigneeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  slaPolicyId?: string;
}

