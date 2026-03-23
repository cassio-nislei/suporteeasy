import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { TenantScoped } from '../common/decorators/tenant-scoped.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@ApiTags('api-keys')
@ApiBearerAuth()
@Controller('api-keys')
@TenantScoped()
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  @Permissions('api-keys:write')
  @ApiOperation({ summary: 'Create tenant API key' })
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateApiKeyDto): Promise<unknown> {
    return this.apiKeysService.create(String(user.tenantId), user.sub, dto);
  }

  @Get()
  @Permissions('api-keys:read')
  @ApiOperation({ summary: 'List tenant API keys' })
  async list(@CurrentUser() user: AuthUser): Promise<unknown> {
    return this.apiKeysService.list(String(user.tenantId));
  }

  @Post(':keyId/revoke')
  @Permissions('api-keys:write')
  @ApiOperation({ summary: 'Revoke API key' })
  async revoke(@CurrentUser() user: AuthUser, @Param('keyId') keyId: string): Promise<unknown> {
    return this.apiKeysService.revoke(String(user.tenantId), keyId);
  }
}
