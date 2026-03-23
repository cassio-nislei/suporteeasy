import { Logger } from '@nestjs/common';
import { EmailProvider, EmailSendInput } from './email-provider.interface';

interface SmtpConfig {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  from?: string;
}

export class SmtpEmailProvider implements EmailProvider {
  private readonly logger = new Logger(SmtpEmailProvider.name);

  constructor(private readonly config: SmtpConfig) {}

  async send(input: EmailSendInput): Promise<{ accepted: boolean; message: string }> {
    if (!this.config.host) {
      return {
        accepted: false,
        message: 'SMTP host is not configured'
      };
    }

    this.logger.log(
      `SMTP abstraction send -> host=${this.config.host}:${this.config.port ?? 25}; to=${input.to}; subject=${input.subject}`
    );

    return {
      accepted: true,
      message: 'Email routed through SMTP abstraction (simulated delivery)'
    };
  }
}
