import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { type RemoteAccessProvider, remoteAccessProviders } from '../remote-access.providers';

export class CreateRemoteSessionDto {
  @ApiProperty()
  @IsString()
  deviceId!: string;

  @ApiPropertyOptional({ enum: remoteAccessProviders, default: 'builtin-sim' })
  @IsOptional()
  @IsString()
  @IsIn(remoteAccessProviders)
  provider?: RemoteAccessProvider = 'builtin-sim';

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> = {};
}
