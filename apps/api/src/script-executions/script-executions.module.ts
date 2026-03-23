import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { AgentsModule } from '../agents/agents.module';
import { queuesEnabled } from '../common/config/runtime-flags';
import { DeviceGroupsModule } from '../device-groups/device-groups.module';
import { DevicesModule } from '../devices/devices.module';
import {
  AUTOMATION_QUEUE,
  SCRIPT_EXECUTION_QUEUE
} from '../jobs/jobs.constants';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ScriptsModule } from '../scripts/scripts.module';
import { AgentCommand, AgentCommandSchema } from './agent-command.schema';
import { ScheduledJob, ScheduledJobSchema } from './scheduled-job.schema';
import { ScriptExecutionGateway } from './script-execution.gateway';
import { ScriptExecution, ScriptExecutionSchema } from './script-execution.schema';
import { ScriptExecutionsController } from './script-executions.controller';
import { ScriptExecutionsProcessor } from './script-executions.processor';
import { ScriptExecutionsService } from './script-executions.service';

@Module({
  imports: [
    ...(queuesEnabled
      ? [
          BullModule.registerQueue(
            { name: SCRIPT_EXECUTION_QUEUE },
            { name: AUTOMATION_QUEUE }
          )
        ]
      : []),
    JwtModule.register({}),
    MongooseModule.forFeature([
      { name: ScriptExecution.name, schema: ScriptExecutionSchema },
      { name: ScheduledJob.name, schema: ScheduledJobSchema },
      { name: AgentCommand.name, schema: AgentCommandSchema }
    ]),
    ScriptsModule,
    DevicesModule,
    DeviceGroupsModule,
    AgentsModule,
    MonitoringModule,
    NotificationsModule
  ],
  controllers: [ScriptExecutionsController],
  providers: [
    ScriptExecutionsService,
    ScriptExecutionGateway,
    ...(queuesEnabled ? [ScriptExecutionsProcessor] : [])
  ],
  exports: [ScriptExecutionsService, MongooseModule, ScriptExecutionGateway]
})
export class ScriptExecutionsModule {}
