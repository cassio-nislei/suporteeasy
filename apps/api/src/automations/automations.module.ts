import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../audit/audit.module';
import { queuesEnabled } from '../common/config/runtime-flags';
import { DevicesModule } from '../devices/devices.module';
import { AUTOMATION_QUEUE } from '../jobs/jobs.constants';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ScriptExecutionsModule } from '../script-executions/script-executions.module';
import { TicketsModule } from '../tickets/tickets.module';
import { AutomationLog, AutomationLogSchema } from './automation-log.schema';
import { Automation, AutomationSchema } from './automation.schema';
import { AutomationsController } from './automations.controller';
import { AutomationsProcessor } from './automations.processor';
import { AutomationsService } from './automations.service';

@Module({
  imports: [
    ...(queuesEnabled ? [BullModule.registerQueue({ name: AUTOMATION_QUEUE })] : []),
    MongooseModule.forFeature([
      { name: Automation.name, schema: AutomationSchema },
      { name: AutomationLog.name, schema: AutomationLogSchema }
    ]),
    TicketsModule,
    NotificationsModule,
    ScriptExecutionsModule,
    DevicesModule,
    MonitoringModule,
    AuditModule
  ],
  controllers: [AutomationsController],
  providers: [AutomationsService, ...(queuesEnabled ? [AutomationsProcessor] : [])],
  exports: [AutomationsService, MongooseModule]
})
export class AutomationsModule {}
