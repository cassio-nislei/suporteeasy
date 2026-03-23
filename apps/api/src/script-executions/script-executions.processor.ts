import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  SCRIPT_EXECUTION_JOB_PROCESS,
  SCRIPT_EXECUTION_JOB_SCHEDULE,
  SCRIPT_EXECUTION_QUEUE
} from '../jobs/jobs.constants';
import { ScriptExecutionsService } from './script-executions.service';

interface ScriptExecutionProcessJobData {
  executionId: string;
}

interface ScriptExecutionScheduledJobData {
  scheduledJobId: string;
}

@Processor(SCRIPT_EXECUTION_QUEUE)
export class ScriptExecutionsProcessor extends WorkerHost {
  private readonly logger = new Logger(ScriptExecutionsProcessor.name);

  constructor(private readonly scriptExecutionsService: ScriptExecutionsService) {
    super();
  }

  async process(
    job: Job<ScriptExecutionProcessJobData | ScriptExecutionScheduledJobData>
  ): Promise<void> {
    if (job.name === SCRIPT_EXECUTION_JOB_PROCESS) {
      await this.scriptExecutionsService.processExecutionJob(job.data as ScriptExecutionProcessJobData);
      return;
    }

    if (job.name === SCRIPT_EXECUTION_JOB_SCHEDULE) {
      await this.scriptExecutionsService.processScheduledJob(
        job.data as ScriptExecutionScheduledJobData
      );
      return;
    }

    this.logger.warn(`Unknown script execution job name: ${job.name}`);
  }
}
