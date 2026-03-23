import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class CreatePortalCommentDto {
  @ApiProperty()
  @IsString()
  @MaxLength(4000)
  body!: string;
}
