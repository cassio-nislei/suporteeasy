import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AUTOMATION_JOB_TRIGGER, AUTOMATION_QUEUE } from '../jobs/jobs.constants';
import { AutomationsService, AutomationTriggerJobPayload } from './automations.service';

@Processor(AUTOMATION_QUEUE)
export class AutomationsProcessor extends WorkerHost {
  private readonly logger = new Logger(AutomationsProcessor.name);

  constructor(private readonly automationsService: AutomationsService) {
    super();
  }

  async process(job: Job<AutomationTriggerJobPayload>): Promise<void> {
    if (job.name !== AUTOMATION_JOB_TRIGGER) {
      this.logger.warn(`Unknown automation job name: ${job.name}`);
      return;
    }

    await this.automationsService.handleTrigger(job.data);
  }
}
