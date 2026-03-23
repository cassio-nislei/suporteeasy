import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { TenantScoped } from '../common/decorators/tenant-scoped.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { CreatePatchPolicyDto } from './dto/create-patch-policy.dto';
import { ListPatchesDto } from './dto/list-patches.dto';
import { SchedulePatchDto } from './dto/schedule-patch.dto';
import { SimulatePatchScanDto } from './dto/simulate-patch-scan.dto';
import { UpdatePatchPolicyDto } from './dto/update-patch-policy.dto';
import { PatchManagementService } from './patch-management.service';

@ApiTags('patch-management')
@ApiBearerAuth()
@Controller('patch-management')
@TenantScoped()
export class PatchManagementController {
  constructor(private readonly patchManagementService: PatchManagementService) {}

  @Post('policies')
  @Permissions('patch-management:write')
  @ApiOperation({ summary: 'Create patch policy' })
  async createPolicy(@CurrentUser() user: AuthUser, @Body() dto: CreatePatchPolicyDto) {
    return this.patchManagementService.createPolicy(String(user.tenantId), dto);
  }

  @Get('policies')
  @Permissions('patch-management:read')
  @ApiOperation({ summary: 'List patch policies' })
  async listPolicies(@CurrentUser() user: AuthUser) {
    return this.patchManagementService.listPolicies(String(user.tenantId));
  }

  @Patch('policies/:policyId')
  @Permissions('patch-management:write')
  @ApiOperation({ summary: 'Update patch policy' })
  async updatePolicy(
    @CurrentUser() user: AuthUser,
    @Param('policyId') policyId: string,
    @Body() dto: UpdatePatchPolicyDto
  ) {
    return this.patchManagementService.updatePolicy(String(user.tenantId), policyId, dto);
  }

  @Delete('policies/:policyId')
  @Permissions('patch-management:write')
  @ApiOperation({ summary: 'Delete patch policy' })
  async removePolicy(@CurrentUser() user: AuthUser, @Param('policyId') policyId: string) {
    return this.patchManagementService.removePolicy(String(user.tenantId), policyId);
  }

  @Post('patches/simulate-scan')
  @Permissions('patch-management:write')
  @ApiOperation({ summary: 'Simulate patch discovery scan' })
  async simulateScan(@CurrentUser() user: AuthUser, @Body() dto: SimulatePatchScanDto) {
    return this.patchManagementService.simulatePatchScan(String(user.tenantId), dto);
  }

  @Get('patches')
  @Permissions('patch-management:read')
  @ApiOperation({ summary: 'List patches' })
  async listPatches(@CurrentUser() user: AuthUser, @Query() query: ListPatchesDto) {
    return this.patchManagementService.listPatches(String(user.tenantId), query);
  }

  @Get('patches/:patchId')
  @Permissions('patch-management:read')
  @ApiOperation({ summary: 'Patch detail' })
  async detailPatch(@CurrentUser() user: AuthUser, @Param('patchId') patchId: string) {
    return this.patchManagementService.findPatchById(String(user.tenantId), patchId);
  }

  @Post('patches/:patchId/approve')
  @Permissions('patch-management:write')
  @ApiOperation({ summary: 'Approve patch for installation' })
  async approvePatch(@CurrentUser() user: AuthUser, @Param('patchId') patchId: string) {
    return this.patchManagementService.approvePatch(String(user.tenantId), patchId);
  }

  @Post('patches/:patchId/schedule')
  @Permissions('patch-management:write')
  @ApiOperation({ summary: 'Schedule patch installation' })
  async schedulePatch(
    @CurrentUser() user: AuthUser,
    @Param('patchId') patchId: string,
    @Body() dto: SchedulePatchDto
  ) {
    return this.patchManagementService.schedulePatch(String(user.tenantId), patchId, dto);
  }

  @Post('patches/:patchId/execute')
  @Permissions('patch-management:write')
  @ApiOperation({ summary: 'Execute simulated patch installation' })
  async executePatch(@CurrentUser() user: AuthUser, @Param('patchId') patchId: string) {
    return this.patchManagementService.executePatch(String(user.tenantId), patchId);
  }
}
