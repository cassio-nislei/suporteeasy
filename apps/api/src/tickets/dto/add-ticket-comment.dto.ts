import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { TicketCommentVisibility } from '../ticket-comment.schema';

export class AddTicketCommentDto {
  @ApiProperty()
  @IsString()
  @MaxLength(4000)
  body!: string;

  @ApiPropertyOptional({ enum: TicketCommentVisibility, default: TicketCommentVisibility.INTERNAL })
  @IsOptional()
  @IsIn([TicketCommentVisibility.PUBLIC, TicketCommentVisibility.INTERNAL])
  visibility?: TicketCommentVisibility = TicketCommentVisibility.INTERNAL;
}

