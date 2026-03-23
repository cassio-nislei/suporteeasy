import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { TenantScoped } from '../common/decorators/tenant-scoped.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { MonitoringService } from '../monitoring/monitoring.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { ListDevicesDto } from './dto/list-devices.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { DevicesService } from './devices.service';

@ApiTags('devices')
@ApiBearerAuth()
@Controller('devices')
@TenantScoped()
export class DevicesController {
  constructor(
    private readonly devicesService: DevicesService,
    private readonly monitoringService: MonitoringService
  ) {}

  @Post()
  @Permissions('devices:write')
  @ApiOperation({ summary: 'Create device' })
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateDeviceDto) {
    return this.devicesService.create(String(user.tenantId), dto);
  }

  @Get()
  @Permissions('devices:read')
  @ApiOperation({ summary: 'List devices with pagination/filter/sort' })
  async list(@CurrentUser() user: AuthUser, @Query() query: ListDevicesDto) {
    return this.devicesService.list(String(user.tenantId), query);
  }

  @Get(':deviceId')
  @Permissions('devices:read')
  @ApiOperation({ summary: 'Get device detail with latest metrics' })
  async detail(@CurrentUser() user: AuthUser, @Param('deviceId') deviceId: string) {
    const tenantId = String(user.tenantId);
    const [device, latestMetrics, agent, recentActivity] = await Promise.all([
      this.devicesService.findById(tenantId, deviceId),
      this.monitoringService.getLatestMetricsForDevice(tenantId, deviceId),
      this.monitoringService.getAgentByDevice(tenantId, deviceId),
      this.monitoringService.getDeviceActivity(tenantId, deviceId, { page: 1, limit: 20 })
    ]);

    return {
      ...device,
      latestMetrics,
      agent,
      recentActivity
    };
  }

  @Patch(':deviceId')
  @Permissions('devices:write')
  @ApiOperation({ summary: 'Update device and assign to client' })
  async update(
    @CurrentUser() user: AuthUser,
    @Param('deviceId') deviceId: string,
    @Body() dto: UpdateDeviceDto
  ) {
    return this.devicesService.update(String(user.tenantId), deviceId, dto);
  }

  @Delete(':deviceId')
  @Permissions('devices:write')
  @ApiOperation({ summary: 'Delete device' })
  async remove(@CurrentUser() user: AuthUser, @Param('deviceId') deviceId: string) {
    return this.devicesService.remove(String(user.tenantId), deviceId);
  }

  @Get(':deviceId/metrics')
  @Permissions('devices:read')
  @ApiOperation({ summary: 'List device metrics history' })
  async metrics(
    @CurrentUser() user: AuthUser,
    @Param('deviceId') deviceId: string,
    @Query('type') type?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50'
  ) {
    return this.monitoringService.listDeviceMetrics(String(user.tenantId), deviceId, {
      type,
      page: Number(page) || 1,
      limit: Number(limit) || 50
    });
  }

  @Get(':deviceId/activity')
  @Permissions('devices:read')
  @ApiOperation({ summary: 'Device activity timeline/history' })
  async activity(
    @CurrentUser() user: AuthUser,
    @Param('deviceId') deviceId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20'
  ) {
    return this.monitoringService.getDeviceActivity(String(user.tenantId), deviceId, {
      page: Number(page) || 1,
      limit: Number(limit) || 20
    });
  }
}
