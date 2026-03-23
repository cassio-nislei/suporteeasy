import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Public } from '../common/decorators/public.decorator';
import { TenantScoped } from '../common/decorators/tenant-scoped.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { ListScriptExecutionsDto } from './dto/list-script-executions.dto';
import { PullAgentCommandsDto } from './dto/pull-agent-commands.dto';
import { ReportScriptResultDto } from './dto/report-script-result.dto';
import { RunScriptOnDeviceDto } from './dto/run-script-on-device.dto';
import { RunScriptOnGroupDto } from './dto/run-script-on-group.dto';
import { ScheduleScriptDto } from './dto/schedule-script.dto';
import { ScriptExecutionsService } from './script-executions.service';

@ApiTags('script-executions')
@Controller('script-executions')
export class ScriptExecutionsController {
  constructor(private readonly scriptExecutionsService: ScriptExecutionsService) {}

  @Post('run')
  @ApiBearerAuth()
  @TenantScoped()
  @Permissions('scripts:write')
  @ApiOperation({ summary: 'Run script for a single device' })
  async runOnDevice(@CurrentUser() user: AuthUser, @Body() dto: RunScriptOnDeviceDto) {
    return this.scriptExecutionsService.runOnDevice(String(user.tenantId), user.sub, dto);
  }

  @Post('run-group')
  @ApiBearerAuth()
  @TenantScoped()
  @Permissions('scripts:write')
  @ApiOperation({ summary: 'Run script for all devices in a group' })
  async runOnGroup(@CurrentUser() user: AuthUser, @Body() dto: RunScriptOnGroupDto) {
    return this.scriptExecutionsService.runOnGroup(String(user.tenantId), user.sub, dto);
  }

  @Post('schedule')
  @ApiBearerAuth()
  @TenantScoped()
  @Permissions('scripts:write')
  @ApiOperation({ summary: 'Schedule script execution' })
  async schedule(@CurrentUser() user: AuthUser, @Body() dto: ScheduleScriptDto) {
    return this.scriptExecutionsService.schedule(String(user.tenantId), user.sub, dto);
  }

  @Get()
  @ApiBearerAuth()
  @TenantScoped()
  @Permissions('scripts:read')
  @ApiOperation({ summary: 'List script executions' })
  async list(@CurrentUser() user: AuthUser, @Query() query: ListScriptExecutionsDto) {
    return this.scriptExecutionsService.list(String(user.tenantId), query);
  }

  @Get('scheduled')
  @ApiBearerAuth()
  @TenantScoped()
  @Permissions('scripts:read')
  @ApiOperation({ summary: 'List scheduled script jobs' })
  async listScheduled(
    @CurrentUser() user: AuthUser,
    @Query('page') page = 1,
    @Query('limit') limit = 20
  ) {
    return this.scriptExecutionsService.listScheduledJobs(String(user.tenantId), Number(page), Number(limit));
  }

  @Get(':executionId')
  @ApiBearerAuth()
  @TenantScoped()
  @Permissions('scripts:read')
  @ApiOperation({ summary: 'Get execution detail' })
  async detail(@CurrentUser() user: AuthUser, @Param('executionId') executionId: string) {
    return this.scriptExecutionsService.findById(String(user.tenantId), executionId);
  }

  @Post('commands/pull')
  @Public()
  @ApiOperation({ summary: 'Agent pulls queued script commands' })
  async pullCommands(@Body() dto: PullAgentCommandsDto) {
    return this.scriptExecutionsService.pullAgentCommands(dto);
  }

  @Post('report')
  @Public()
  @ApiOperation({ summary: 'Agent reports script result' })
  async reportResult(@Body() dto: ReportScriptResultDto) {
    return this.scriptExecutionsService.reportResult(dto);
  }
}
