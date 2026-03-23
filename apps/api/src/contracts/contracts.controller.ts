import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { TenantScoped } from '../common/decorators/tenant-scoped.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { ListContractsDto } from './dto/list-contracts.dto';
import { UpdateContractDto } from './dto/update-contract.dto';

@ApiTags('contracts')
@ApiBearerAuth()
@Controller('contracts')
@TenantScoped()
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Post()
  @Permissions('contracts:write')
  @ApiOperation({ summary: 'Create contract linked to client' })
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateContractDto) {
    return this.contractsService.create(String(user.tenantId), dto);
  }

  @Get()
  @Permissions('contracts:read')
  @ApiOperation({ summary: 'List contracts' })
  async list(@CurrentUser() user: AuthUser, @Query() query: ListContractsDto) {
    return this.contractsService.list(String(user.tenantId), query);
  }

  @Get(':contractId')
  @Permissions('contracts:read')
  @ApiOperation({ summary: 'Get contract detail' })
  async detail(@CurrentUser() user: AuthUser, @Param('contractId') contractId: string) {
    return this.contractsService.findById(String(user.tenantId), contractId);
  }

  @Patch(':contractId')
  @Permissions('contracts:write')
  @ApiOperation({ summary: 'Update contract' })
  async update(
    @CurrentUser() user: AuthUser,
    @Param('contractId') contractId: string,
    @Body() dto: UpdateContractDto
  ) {
    return this.contractsService.update(String(user.tenantId), contractId, dto);
  }

  @Delete(':contractId')
  @Permissions('contracts:write')
  @ApiOperation({ summary: 'Delete contract' })
  async remove(@CurrentUser() user: AuthUser, @Param('contractId') contractId: string) {
    return this.contractsService.remove(String(user.tenantId), contractId);
  }
}
