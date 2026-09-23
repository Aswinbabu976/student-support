import { logger } from '../../shared/logger.js';
import type { EmailService, StudentVerificationEmail } from './email.service.js';

export class LoggingEmailAdapter implements EmailService {
  constructor(private readonly logVerificationLinks: boolean) {}

  async sendStudentVerificationEmail(message: StudentVerificationEmail): Promise<void> {
    logger.info('Student verification email queued', {
      to: message.to,
      ...(this.logVerificationLinks ? { verificationUrl: message.verificationUrl } : {}),
    });
  }
}
