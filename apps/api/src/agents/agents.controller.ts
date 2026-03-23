import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MonitoringService } from '../monitoring/monitoring.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Public } from '../common/decorators/public.decorator';
import { TenantScoped } from '../common/decorators/tenant-scoped.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { AgentHeartbeatDto } from './dto/agent-heartbeat.dto';
import { RegisterAgentDto } from './dto/register-agent.dto';
import { AgentsService } from './agents.service';

@ApiTags('agents')
@Controller('agents')
export class AgentsController {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly monitoringService: MonitoringService
  ) {}

  @Post('register')
  @ApiBearerAuth()
  @TenantScoped()
  @Permissions('agents:write')
  @ApiOperation({ summary: 'Register local agent for a device' })
  async register(@CurrentUser() user: AuthUser, @Body() dto: RegisterAgentDto) {
    return this.agentsService.register(String(user.tenantId), dto);
  }

  @Post('heartbeat')
  @Public()
  @ApiOperation({ summary: 'Agent heartbeat endpoint' })
  async heartbeat(@Body() dto: AgentHeartbeatDto) {
    return this.monitoringService.processHeartbeat(dto);
  }
}
