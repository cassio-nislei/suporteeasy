import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { TenantScoped } from '../common/decorators/tenant-scoped.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { CreateDeviceGroupDto } from './dto/create-device-group.dto';
import { UpdateDeviceGroupDto } from './dto/update-device-group.dto';
import { DeviceGroupsService } from './device-groups.service';

@ApiTags('device-groups')
@ApiBearerAuth()
@Controller('device-groups')
@TenantScoped()
export class DeviceGroupsController {
  constructor(private readonly deviceGroupsService: DeviceGroupsService) {}

  @Post()
  @Permissions('devices:write')
  @ApiOperation({ summary: 'Create device group' })
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateDeviceGroupDto) {
    return this.deviceGroupsService.create(String(user.tenantId), dto);
  }

  @Get()
  @Permissions('devices:read')
  @ApiOperation({ summary: 'List device groups' })
  async list(@CurrentUser() user: AuthUser) {
    return this.deviceGroupsService.list(String(user.tenantId));
  }

  @Get(':groupId')
  @Permissions('devices:read')
  @ApiOperation({ summary: 'Get device group detail' })
  async detail(@CurrentUser() user: AuthUser, @Param('groupId') groupId: string) {
    return this.deviceGroupsService.findById(String(user.tenantId), groupId);
  }

  @Patch(':groupId')
  @Permissions('devices:write')
  @ApiOperation({ summary: 'Update device group' })
  async update(
    @CurrentUser() user: AuthUser,
    @Param('groupId') groupId: string,
    @Body() dto: UpdateDeviceGroupDto
  ) {
    return this.deviceGroupsService.update(String(user.tenantId), groupId, dto);
  }

  @Delete(':groupId')
  @Permissions('devices:write')
  @ApiOperation({ summary: 'Delete device group' })
  async remove(@CurrentUser() user: AuthUser, @Param('groupId') groupId: string) {
    return this.deviceGroupsService.remove(String(user.tenantId), groupId);
  }
}
