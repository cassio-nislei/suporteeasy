import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { TenantScoped } from '../common/decorators/tenant-scoped.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { CreateScriptDto } from './dto/create-script.dto';
import { ListScriptsDto } from './dto/list-scripts.dto';
import { UpdateScriptDto } from './dto/update-script.dto';
import { ScriptsService } from './scripts.service';

@ApiTags('scripts')
@ApiBearerAuth()
@Controller('scripts')
@TenantScoped()
export class ScriptsController {
  constructor(private readonly scriptsService: ScriptsService) {}

  @Post()
  @Permissions('scripts:write')
  @ApiOperation({ summary: 'Create script' })
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateScriptDto) {
    return this.scriptsService.create(String(user.tenantId), dto);
  }

  @Get()
  @Permissions('scripts:read')
  @ApiOperation({ summary: 'List scripts' })
  async list(@CurrentUser() user: AuthUser, @Query() query: ListScriptsDto) {
    return this.scriptsService.list(String(user.tenantId), query);
  }

  @Get(':scriptId')
  @Permissions('scripts:read')
  @ApiOperation({ summary: 'Get script detail' })
  async detail(@CurrentUser() user: AuthUser, @Param('scriptId') scriptId: string) {
    return this.scriptsService.findById(String(user.tenantId), scriptId);
  }

  @Patch(':scriptId')
  @Permissions('scripts:write')
  @ApiOperation({ summary: 'Update script' })
  async update(
    @CurrentUser() user: AuthUser,
    @Param('scriptId') scriptId: string,
    @Body() dto: UpdateScriptDto
  ) {
    return this.scriptsService.update(String(user.tenantId), scriptId, dto);
  }

  @Delete(':scriptId')
  @Permissions('scripts:write')
  @ApiOperation({ summary: 'Delete script' })
  async remove(@CurrentUser() user: AuthUser, @Param('scriptId') scriptId: string) {
    return this.scriptsService.remove(String(user.tenantId), scriptId);
  }
}
