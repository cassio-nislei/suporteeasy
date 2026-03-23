import { Logger } from '@nestjs/common';
import { EmailProvider, EmailSendInput } from './email-provider.interface';

export class ConsoleEmailProvider implements EmailProvider {
  private readonly logger = new Logger(ConsoleEmailProvider.name);

  async send(input: EmailSendInput): Promise<{ accepted: boolean; message: string }> {
    this.logger.log(
      `Simulated email -> to=${input.to}; subject=${input.subject}; htmlLength=${input.html.length}`
    );

    return {
      accepted: true,
      message: 'Email simulated via console provider'
    };
  }
}
