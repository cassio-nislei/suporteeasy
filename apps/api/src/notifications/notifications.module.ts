import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { queuesEnabled } from '../common/config/runtime-flags';
import { IntegrationsModule } from '../integrations/integrations.module';
import { NOTIFICATION_QUEUE } from '../jobs/jobs.constants';
import { UsersModule } from '../users/users.module';
import { Notification, NotificationSchema } from './notification.schema';
import { NotificationsController } from './notifications.controller';
import { NotificationsProcessor } from './notifications.processor';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    ...(queuesEnabled ? [BullModule.registerQueue({ name: NOTIFICATION_QUEUE })] : []),
    MongooseModule.forFeature([{ name: Notification.name, schema: NotificationSchema }]),
    UsersModule,
    IntegrationsModule
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, ...(queuesEnabled ? [NotificationsProcessor] : [])],
  exports: [NotificationsService, MongooseModule]
})
export class NotificationsModule {}
