import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { TenantScoped } from '../common/decorators/tenant-scoped.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { ListClientsDto } from './dto/list-clients.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@ApiTags('clients')
@ApiBearerAuth()
@Controller('clients')
@TenantScoped()
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @Permissions('clients:write')
  @ApiOperation({ summary: 'Create client' })
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateClientDto) {
    return this.clientsService.create(String(user.tenantId), dto);
  }

  @Get()
  @Permissions('clients:read')
  @ApiOperation({ summary: 'List clients with pagination/filter/sort' })
  async list(@CurrentUser() user: AuthUser, @Query() query: ListClientsDto) {
    return this.clientsService.list(String(user.tenantId), query);
  }

  @Get(':clientId')
  @Permissions('clients:read')
  @ApiOperation({ summary: 'Get client detail' })
  async detail(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string) {
    return this.clientsService.findById(String(user.tenantId), clientId);
  }

  @Patch(':clientId')
  @Permissions('clients:write')
  @ApiOperation({ summary: 'Update client' })
  async update(
    @CurrentUser() user: AuthUser,
    @Param('clientId') clientId: string,
    @Body() dto: UpdateClientDto
  ) {
    return this.clientsService.update(String(user.tenantId), clientId, dto);
  }

  @Delete(':clientId')
  @Permissions('clients:write')
  @ApiOperation({ summary: 'Delete client' })
  async remove(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string) {
    return this.clientsService.remove(String(user.tenantId), clientId);
  }
}
