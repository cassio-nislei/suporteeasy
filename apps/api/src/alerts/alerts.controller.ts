import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { TenantScoped } from '../common/decorators/tenant-scoped.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { AlertsService } from './alerts.service';
import { CreateAlertRuleDto } from './dto/create-alert-rule.dto';
import { ListAlertsDto } from './dto/list-alerts.dto';
import { ListAlertRulesDto } from './dto/list-alert-rules.dto';
import { UpdateAlertRuleDto } from './dto/update-alert-rule.dto';

@ApiTags('alerts')
@ApiBearerAuth()
@Controller('alerts')
@TenantScoped()
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Post('rules')
  @Permissions('alerts:write')
  @ApiOperation({ summary: 'Create alert rule' })
  async createRule(@CurrentUser() user: AuthUser, @Body() dto: CreateAlertRuleDto) {
    return this.alertsService.createRule(String(user.tenantId), dto);
  }

  @Get('rules')
  @Permissions('alerts:read')
  @ApiOperation({ summary: 'List alert rules' })
  async listRules(@CurrentUser() user: AuthUser, @Query() query: ListAlertRulesDto) {
    return this.alertsService.listRules(String(user.tenantId), query);
  }

  @Get('rules/:ruleId')
  @Permissions('alerts:read')
  @ApiOperation({ summary: 'Get alert rule by id' })
  async getRule(@CurrentUser() user: AuthUser, @Param('ruleId') ruleId: string) {
    return this.alertsService.findRuleById(String(user.tenantId), ruleId);
  }

  @Patch('rules/:ruleId')
  @Permissions('alerts:write')
  @ApiOperation({ summary: 'Update alert rule' })
  async updateRule(
    @CurrentUser() user: AuthUser,
    @Param('ruleId') ruleId: string,
    @Body() dto: UpdateAlertRuleDto
  ) {
    return this.alertsService.updateRule(String(user.tenantId), ruleId, dto);
  }

  @Delete('rules/:ruleId')
  @Permissions('alerts:write')
  @ApiOperation({ summary: 'Delete alert rule' })
  async removeRule(@CurrentUser() user: AuthUser, @Param('ruleId') ruleId: string) {
    return this.alertsService.removeRule(String(user.tenantId), ruleId);
  }

  @Get()
  @Permissions('alerts:read')
  @ApiOperation({ summary: 'List alerts' })
  async listAlerts(@CurrentUser() user: AuthUser, @Query() query: ListAlertsDto) {
    return this.alertsService.listAlerts(String(user.tenantId), query);
  }

  @Get(':alertId')
  @Permissions('alerts:read')
  @ApiOperation({ summary: 'Get alert detail' })
  async getAlert(@CurrentUser() user: AuthUser, @Param('alertId') alertId: string) {
    return this.alertsService.findAlertById(String(user.tenantId), alertId);
  }

  @Post(':alertId/acknowledge')
  @Permissions('alerts:write')
  @ApiOperation({ summary: 'Acknowledge alert' })
  async acknowledge(@CurrentUser() user: AuthUser, @Param('alertId') alertId: string) {
    return this.alertsService.acknowledgeAlert(String(user.tenantId), alertId, user.sub);
  }

  @Post(':alertId/resolve')
  @Permissions('alerts:write')
  @ApiOperation({ summary: 'Resolve alert' })
  async resolve(@CurrentUser() user: AuthUser, @Param('alertId') alertId: string) {
    return this.alertsService.resolveAlert(String(user.tenantId), alertId, user.sub);
  }

  @Post(':alertId/create-ticket')
  @Permissions('alerts:write', 'tickets:write')
  @ApiOperation({ summary: 'Create ticket from alert' })
  async createTicket(@CurrentUser() user: AuthUser, @Param('alertId') alertId: string) {
    return this.alertsService.createTicketFromAlert(String(user.tenantId), alertId, user.sub);
  }
}

