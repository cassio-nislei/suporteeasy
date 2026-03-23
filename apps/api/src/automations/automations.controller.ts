import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { TenantScoped } from '../common/decorators/tenant-scoped.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { CreateAutomationDto } from './dto/create-automation.dto';
import { ListAutomationLogsDto } from './dto/list-automation-logs.dto';
import { ListAutomationsDto } from './dto/list-automations.dto';
import { UpdateAutomationDto } from './dto/update-automation.dto';
import { AutomationsService } from './automations.service';

@ApiTags('automations')
@ApiBearerAuth()
@Controller('automations')
@TenantScoped()
export class AutomationsController {
  constructor(private readonly automationsService: AutomationsService) {}

  @Post()
  @Permissions('automations:write')
  @ApiOperation({ summary: 'Create automation' })
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateAutomationDto) {
    return this.automationsService.create(String(user.tenantId), dto);
  }

  @Get()
  @Permissions('automations:read')
  @ApiOperation({ summary: 'List automations' })
  async list(@CurrentUser() user: AuthUser, @Query() query: ListAutomationsDto) {
    return this.automationsService.list(String(user.tenantId), query);
  }

  @Get('logs')
  @Permissions('automations:read')
  @ApiOperation({ summary: 'List automation execution logs' })
  async listLogs(@CurrentUser() user: AuthUser, @Query() query: ListAutomationLogsDto) {
    return this.automationsService.listLogs(String(user.tenantId), query);
  }

  @Get(':automationId')
  @Permissions('automations:read')
  @ApiOperation({ summary: 'Get automation detail' })
  async detail(@CurrentUser() user: AuthUser, @Param('automationId') automationId: string) {
    return this.automationsService.findById(String(user.tenantId), automationId);
  }

  @Patch(':automationId')
  @Permissions('automations:write')
  @ApiOperation({ summary: 'Update automation' })
  async update(
    @CurrentUser() user: AuthUser,
    @Param('automationId') automationId: string,
    @Body() dto: UpdateAutomationDto
  ) {
    return this.automationsService.update(String(user.tenantId), automationId, dto);
  }

  @Delete(':automationId')
  @Permissions('automations:write')
  @ApiOperation({ summary: 'Delete automation' })
  async remove(@CurrentUser() user: AuthUser, @Param('automationId') automationId: string) {
    return this.automationsService.remove(String(user.tenantId), automationId);
  }
}
