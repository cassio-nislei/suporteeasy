import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import {
  HEARTBEAT_TIMEOUT_JOB_CHECK,
  HEARTBEAT_TIMEOUT_QUEUE
} from './jobs.constants';

@Injectable()
export class HeartbeatTimeoutScheduler implements OnModuleInit {
  private readonly logger = new Logger(HeartbeatTimeoutScheduler.name);

  constructor(
    private readonly configService: ConfigService,
    @Optional()
    @InjectQueue(HEARTBEAT_TIMEOUT_QUEUE)
    private readonly heartbeatTimeoutQueue?: Queue
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.heartbeatTimeoutQueue) {
      return;
    }

    const intervalMs = Number(
      this.configService.get<string>('HEARTBEAT_TIMEOUT_CHECK_INTERVAL_MS', '30000')
    );

    await this.heartbeatTimeoutQueue.add(
      HEARTBEAT_TIMEOUT_JOB_CHECK,
      {},
      {
        jobId: HEARTBEAT_TIMEOUT_JOB_CHECK,
        repeat: {
          every: Math.max(5000, intervalMs)
        },
        removeOnComplete: true,
        removeOnFail: 50
      }
    );

    this.logger.log(`Heartbeat timeout scheduler started (every ${Math.max(5000, intervalMs)}ms)`);
  }
}
