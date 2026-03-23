import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';
import { type RemoteInteractionMode, remoteInteractionModes } from '../remote-access.providers';

export class UpdateRemoteSessionInteractionModeDto {
  @ApiProperty({ enum: remoteInteractionModes, default: 'view-only' })
  @IsString()
  @IsIn(remoteInteractionModes)
  interactionMode!: RemoteInteractionMode;
}
