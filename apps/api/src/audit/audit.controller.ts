import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { TenantScoped } from '../common/decorators/tenant-scoped.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';
import { AuditService } from './audit.service';

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit')
@TenantScoped()
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @Permissions('audit:read')
  @ApiOperation({ summary: 'List audit logs for tenant' })
  async list(@CurrentUser() user: AuthUser, @Query() query: ListAuditLogsDto) {
    return this.auditService.listLogs(user.tenantId, query);
  }
}
