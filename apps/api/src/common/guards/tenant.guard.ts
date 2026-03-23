import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TENANT_SCOPED_KEY } from '../decorators/tenant-scoped.decorator';
import { RequestWithUser } from '../interfaces/request-with-user.interface';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const tenantScoped = this.reflector.getAllAndOverride<boolean>(TENANT_SCOPED_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!tenantScoped) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user) {
      return false;
    }

    const headerTenantValue = request.headers['x-tenant-id'];
    const headerTenantId = Array.isArray(headerTenantValue)
      ? headerTenantValue[0]
      : headerTenantValue;

    if (user.permissions.includes('*')) {
      if (user.tenantId) {
        if (headerTenantId && headerTenantId !== user.tenantId) {
          throw new ForbiddenException('Tenant mismatch');
        }

        request.tenantId = user.tenantId;
        return true;
      }

      if (!headerTenantId) {
        throw new ForbiddenException('x-tenant-id header is required for platform access');
      }

      if (!/^[a-fA-F0-9]{24}$/.test(headerTenantId)) {
        throw new ForbiddenException('Invalid tenant id in x-tenant-id header');
      }

      user.tenantId = headerTenantId;
      request.tenantId = headerTenantId;
      return true;
    }

    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }

    if (headerTenantId && headerTenantId !== user.tenantId) {
      throw new ForbiddenException('Tenant mismatch');
    }

    request.tenantId = user.tenantId;
    return true;
  }
}
