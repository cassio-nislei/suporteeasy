import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { TicketPriority } from '../../tickets/ticket.schema';

export class CreatePortalTicketDto {
  @ApiProperty()
  @IsString()
  @MaxLength(180)
  subject!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(4000)
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({ enum: TicketPriority, default: TicketPriority.MEDIUM })
  @IsOptional()
  @IsIn([TicketPriority.LOW, TicketPriority.MEDIUM, TicketPriority.HIGH, TicketPriority.URGENT])
  priority?: TicketPriority = TicketPriority.MEDIUM;
}
