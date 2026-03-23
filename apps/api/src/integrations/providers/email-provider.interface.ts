export interface EmailSendInput {
  to: string;
  subject: string;
  html: string;
}

export interface EmailProvider {
  send(input: EmailSendInput): Promise<{ accepted: boolean; message: string }>;
}
