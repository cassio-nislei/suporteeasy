import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AUTH_EMAIL_QUEUE } from './auth.constants';

interface AuthEmailJob {
  type: 'forgot-password' | 'email-verification';
  email: string;
  token: string;
}

@Processor(AUTH_EMAIL_QUEUE)
export class AuthEmailProcessor extends WorkerHost {
  private readonly logger = new Logger(AuthEmailProcessor.name);

  async process(job: Job<AuthEmailJob>): Promise<void> {
    this.logger.log(
      `Email job processed type=${job.data.type} to=${job.data.email} token=${job.data.token.substring(0, 8)}...`
    );
  }
}
