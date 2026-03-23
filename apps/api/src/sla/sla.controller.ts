import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { TenantScoped } from '../common/decorators/tenant-scoped.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { CreateSlaPolicyDto } from './dto/create-sla-policy.dto';
import { ListSlaPoliciesDto } from './dto/list-sla-policies.dto';
import { UpdateSlaPolicyDto } from './dto/update-sla-policy.dto';
import { SlaService } from './sla.service';

@ApiTags('sla')
@ApiBearerAuth()
@Controller('sla')
@TenantScoped()
export class SlaController {
  constructor(private readonly slaService: SlaService) {}

  @Post('policies')
  @Permissions('sla:write')
  @ApiOperation({ summary: 'Create SLA policy' })
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateSlaPolicyDto) {
    return this.slaService.create(String(user.tenantId), dto);
  }

  @Get('policies')
  @Permissions('sla:read')
  @ApiOperation({ summary: 'List SLA policies' })
  async list(@CurrentUser() user: AuthUser, @Query() query: ListSlaPoliciesDto) {
    return this.slaService.list(String(user.tenantId), query);
  }

  @Get('policies/:policyId')
  @Permissions('sla:read')
  @ApiOperation({ summary: 'Get SLA policy detail' })
  async detail(@CurrentUser() user: AuthUser, @Param('policyId') policyId: string) {
    return this.slaService.findById(String(user.tenantId), policyId);
  }

  @Patch('policies/:policyId')
  @Permissions('sla:write')
  @ApiOperation({ summary: 'Update SLA policy' })
  async update(
    @CurrentUser() user: AuthUser,
    @Param('policyId') policyId: string,
    @Body() dto: UpdateSlaPolicyDto
  ) {
    return this.slaService.update(String(user.tenantId), policyId, dto);
  }

  @Delete('policies/:policyId')
  @Permissions('sla:write')
  @ApiOperation({ summary: 'Delete SLA policy' })
  async remove(@CurrentUser() user: AuthUser, @Param('policyId') policyId: string) {
    return this.slaService.remove(String(user.tenantId), policyId);
  }
}

