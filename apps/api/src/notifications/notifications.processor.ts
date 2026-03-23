import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NOTIFICATION_JOB_CREATE, NOTIFICATION_QUEUE } from '../jobs/jobs.constants';
import { NotificationType } from './notification.schema';
import { NotificationsService } from './notifications.service';

interface NotificationJobData {
  tenantId: string;
  userIds: string[];
  input: {
    type: NotificationType;
    title: string;
    body: string;
    metadata?: Record<string, unknown>;
  };
}

@Processor(NOTIFICATION_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(private readonly notificationsService: NotificationsService) {
    super();
  }

  async process(job: Job<NotificationJobData>): Promise<void> {
    if (job.name !== NOTIFICATION_JOB_CREATE) {
      this.logger.warn(`Unknown notification job name: ${job.name}`);
      return;
    }

    await this.notificationsService.createForUsersNow(
      job.data.tenantId,
      job.data.userIds,
      job.data.input
    );
  }
}
