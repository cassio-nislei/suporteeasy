import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { TenantScoped } from '../common/decorators/tenant-scoped.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { DashboardsService } from './dashboards.service';

@ApiTags('dashboards')
@ApiBearerAuth()
@Controller('dashboards')
@TenantScoped()
export class DashboardsController {
  constructor(private readonly dashboardsService: DashboardsService) {}

  @Get('overview')
  @Permissions('dashboard:read')
  @ApiOperation({ summary: 'Dashboard aggregates for current tenant' })
  async overview(@CurrentUser() user: AuthUser) {
    return this.dashboardsService.overview(String(user.tenantId));
  }
}
