import { BullModule } from '@nestjs/bullmq';
import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { queuesEnabled } from '../common/config/runtime-flags';
import { DevicesModule } from '../devices/devices.module';
import { AUTOMATION_QUEUE } from '../jobs/jobs.constants';
import { NotificationsModule } from '../notifications/notifications.module';
import { TicketsModule } from '../tickets/tickets.module';
import { AlertRule, AlertRuleSchema } from './alert-rule.schema';
import { Alert, AlertSchema } from './alert.schema';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';

@Module({
  imports: [
    ...(queuesEnabled ? [BullModule.registerQueue({ name: AUTOMATION_QUEUE })] : []),
    MongooseModule.forFeature([
      { name: AlertRule.name, schema: AlertRuleSchema },
      { name: Alert.name, schema: AlertSchema }
    ]),
    forwardRef(() => DevicesModule),
    TicketsModule,
    NotificationsModule
  ],
  controllers: [AlertsController],
  providers: [AlertsService],
  exports: [AlertsService, MongooseModule]
})
export class AlertsModule {}
