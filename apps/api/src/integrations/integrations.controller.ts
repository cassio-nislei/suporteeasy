import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { TenantScoped } from '../common/decorators/tenant-scoped.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { CreateIntegrationDto } from './dto/create-integration.dto';
import { ListIntegrationsDto } from './dto/list-integrations.dto';
import { TestEmailDto } from './dto/test-email.dto';
import { TestWebhookDto } from './dto/test-webhook.dto';
import { UpdateIntegrationDto } from './dto/update-integration.dto';
import { IntegrationsService } from './integrations.service';

@ApiTags('integrations')
@ApiBearerAuth()
@Controller('integrations')
@TenantScoped()
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Post()
  @Permissions('integrations:write')
  @ApiOperation({ summary: 'Create integration' })
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateIntegrationDto) {
    return this.integrationsService.create(String(user.tenantId), user.sub, dto);
  }

  @Get()
  @Permissions('integrations:read')
  @ApiOperation({ summary: 'List integrations' })
  async list(@CurrentUser() user: AuthUser, @Query() query: ListIntegrationsDto) {
    return this.integrationsService.list(String(user.tenantId), query);
  }

  @Get(':integrationId')
  @Permissions('integrations:read')
  @ApiOperation({ summary: 'Get integration detail' })
  async detail(@CurrentUser() user: AuthUser, @Param('integrationId') integrationId: string) {
    return this.integrationsService.findById(String(user.tenantId), integrationId);
  }

  @Patch(':integrationId')
  @Permissions('integrations:write')
  @ApiOperation({ summary: 'Update integration' })
  async update(
    @CurrentUser() user: AuthUser,
    @Param('integrationId') integrationId: string,
    @Body() dto: UpdateIntegrationDto
  ) {
    return this.integrationsService.update(String(user.tenantId), user.sub, integrationId, dto);
  }

  @Delete(':integrationId')
  @Permissions('integrations:write')
  @ApiOperation({ summary: 'Delete integration' })
  async remove(@CurrentUser() user: AuthUser, @Param('integrationId') integrationId: string) {
    return this.integrationsService.remove(String(user.tenantId), user.sub, integrationId);
  }

  @Post('test/webhook')
  @Permissions('integrations:write')
  @ApiOperation({ summary: 'Send test outbound webhook events for tenant integrations' })
  async testWebhook(@CurrentUser() user: AuthUser, @Body() dto: TestWebhookDto) {
    return this.integrationsService.testWebhook(String(user.tenantId), dto);
  }

  @Post('test/email')
  @Permissions('integrations:write')
  @ApiOperation({ summary: 'Send test email through provider abstraction' })
  async testEmail(@CurrentUser() user: AuthUser, @Body() dto: TestEmailDto) {
    return this.integrationsService.testEmail(String(user.tenantId), dto);
  }
}
