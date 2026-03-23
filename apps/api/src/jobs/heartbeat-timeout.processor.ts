import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MonitoringService } from '../monitoring/monitoring.service';
import { HEARTBEAT_TIMEOUT_JOB_CHECK, HEARTBEAT_TIMEOUT_QUEUE } from './jobs.constants';

@Processor(HEARTBEAT_TIMEOUT_QUEUE)
export class HeartbeatTimeoutProcessor extends WorkerHost {
  private readonly logger = new Logger(HeartbeatTimeoutProcessor.name);

  constructor(private readonly monitoringService: MonitoringService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== HEARTBEAT_TIMEOUT_JOB_CHECK) {
      this.logger.warn(`Unknown heartbeat timeout job name: ${job.name}`);
      return;
    }

    await this.monitoringService.runHeartbeatTimeoutCheck();
  }
}
