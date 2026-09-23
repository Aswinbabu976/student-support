export type StudentVerificationEmail = {
  to: string;
  verificationUrl: string;
};

export interface EmailService {
  sendStudentVerificationEmail(message: StudentVerificationEmail): Promise<void>;
}
