import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { TenantScoped } from '../common/decorators/tenant-scoped.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { UpsertSettingsDto } from './dto/upsert-settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
@TenantScoped()
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @Permissions('settings:read')
  @ApiOperation({ summary: 'List tenant settings' })
  async list(@CurrentUser() user: AuthUser) {
    return this.settingsService.list(String(user.tenantId));
  }

  @Get(':key')
  @Permissions('settings:read')
  @ApiOperation({ summary: 'Get setting by key' })
  async detail(@CurrentUser() user: AuthUser, @Param('key') key: string) {
    return this.settingsService.getByKey(String(user.tenantId), key);
  }

  @Post()
  @Permissions('settings:write')
  @ApiOperation({ summary: 'Upsert setting value by key' })
  async upsert(@CurrentUser() user: AuthUser, @Body() dto: UpsertSettingsDto) {
    return this.settingsService.upsert(String(user.tenantId), user.sub, dto);
  }
}
