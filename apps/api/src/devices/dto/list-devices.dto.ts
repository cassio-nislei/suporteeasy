import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { DeviceOnlineStatus } from '../device.schema';
import { PaginationDto } from './common.dto';

export class ListDevicesDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ enum: DeviceOnlineStatus })
  @IsOptional()
  @IsIn([DeviceOnlineStatus.ONLINE, DeviceOnlineStatus.OFFLINE, DeviceOnlineStatus.UNKNOWN])
  onlineStatus?: DeviceOnlineStatus;

  @ApiPropertyOptional({ default: 'createdAt', enum: ['createdAt', 'hostname', 'onlineStatus', 'lastHeartbeatAt'] })
  @IsOptional()
  @IsIn(['createdAt', 'hostname', 'onlineStatus', 'lastHeartbeatAt'])
  sortBy?: 'createdAt' | 'hostname' | 'onlineStatus' | 'lastHeartbeatAt' = 'createdAt';

  @ApiPropertyOptional({ default: 'desc', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
