import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { TenantScoped } from '../common/decorators/tenant-scoped.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
@TenantScoped()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Permissions('notifications:read')
  @ApiOperation({ summary: 'List notifications for current user' })
  async list(@CurrentUser() user: AuthUser, @Query() query: ListNotificationsDto) {
    return this.notificationsService.listForUser(String(user.tenantId), user.sub, query);
  }

  @Post(':notificationId/read')
  @Permissions('notifications:read')
  @ApiOperation({ summary: 'Mark notification as read' })
  async markRead(@CurrentUser() user: AuthUser, @Param('notificationId') notificationId: string) {
    return this.notificationsService.markRead(String(user.tenantId), user.sub, notificationId);
  }

  @Post('read-all')
  @Permissions('notifications:read')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllRead(@CurrentUser() user: AuthUser) {
    return this.notificationsService.markAllRead(String(user.tenantId), user.sub);
  }
}

