import { VerificationStatus, UserRole } from '@prisma/client';

export type PublicStudentUser = {
  id: string;
  email: string;
  role: typeof UserRole.STUDENT;
  verificationStatus: VerificationStatus;
};

export type StudentRegistrationResult = {
  user: PublicStudentUser;
  message: string;
};

export type EmailVerificationResult = {
  user: PublicStudentUser;
  message: string;
};

export type RegistrationConfig = {
  universityEmailDomains: string[];
  passwordPolicy: {
    minLength: number;
    requireLetter: boolean;
    requireNumber: boolean;
  };
  preferredPaymentMethods: Array<'CARD' | 'PAYPAL' | 'BANK_TRANSFER'>;
};
