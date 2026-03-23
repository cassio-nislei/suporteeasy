import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class PullAgentCommandsDto {
  @ApiProperty()
  @IsString()
  agentToken!: string;
}
