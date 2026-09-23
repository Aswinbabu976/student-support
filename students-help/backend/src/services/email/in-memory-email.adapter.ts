import type { EmailService, StudentVerificationEmail } from './email.service.js';

export class InMemoryEmailAdapter implements EmailService {
  readonly sent: StudentVerificationEmail[] = [];

  async sendStudentVerificationEmail(message: StudentVerificationEmail): Promise<void> {
    this.sent.push(message);
  }

  lastMessage(): StudentVerificationEmail | undefined {
    return this.sent.at(-1);
  }

  clear(): void {
    this.sent.length = 0;
  }
}
