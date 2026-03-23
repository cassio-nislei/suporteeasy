import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { RequestWithUser } from '../interfaces/request-with-user.interface';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    if (request.user?.tenantId) {
      request.tenantId = request.user.tenantId;
    } else {
      const headerTenantId = request.headers['x-tenant-id'];
      request.tenantId = typeof headerTenantId === 'string' ? headerTenantId : null;
    }

    return next.handle();
  }
}
