import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { queuesEnabled } from '../common/config/runtime-flags';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { HeartbeatTimeoutProcessor } from './heartbeat-timeout.processor';
import { HeartbeatTimeoutScheduler } from './heartbeat-timeout.scheduler';
import { HEARTBEAT_TIMEOUT_QUEUE } from './jobs.constants';

@Module({
  imports: [
    ...(queuesEnabled ? [BullModule.registerQueue({ name: HEARTBEAT_TIMEOUT_QUEUE })] : []),
    MonitoringModule
  ],
  providers: [...(queuesEnabled ? [HeartbeatTimeoutProcessor, HeartbeatTimeoutScheduler] : [])],
  exports: [...(queuesEnabled ? [BullModule] : [])]
})
export class JobsModule {}
