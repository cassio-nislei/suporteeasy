import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { TenantScoped } from '../common/decorators/tenant-scoped.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { User } from './user.schema';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @TenantScoped()
  @Permissions('users:read')
  @ApiOperation({ summary: 'List tenant users' })
  async listUsers(@CurrentUser() user: AuthUser) {
    const users = await this.usersService.listByTenant(String(user.tenantId));
    return users.map((tenantUser) => this.serializeUser(tenantUser));
  }

  private serializeUser(user: User) {
    return {
      id: user._id,
      tenantId: user.tenantId,
      email: user.email,
      roleIds: user.roleIds,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      emailVerifiedAt: user.emailVerifiedAt,
      inviteAcceptedAt: user.inviteAcceptedAt,
      isPortalUser: user.isPortalUser,
      portalClientIds: user.portalClientIds
    };
  }
}
