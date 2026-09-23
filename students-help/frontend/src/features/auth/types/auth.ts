export type UserRole = 'STUDENT' | 'HELP_SEEKER' | 'ADMIN';
export type VerificationStatus = 'UNVERIFIED' | 'VERIFIED';

export type PublicStudentUser = {
  id: string;
  email: string;
  role: 'STUDENT';
  verificationStatus: VerificationStatus;
};

export type StudentRegistrationResponse = {
  user: PublicStudentUser;
  message: string;
};

export type EmailVerificationResponse = {
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
  preferredPaymentMethods?: Array<'CARD' | 'PAYPAL' | 'BANK_TRANSFER'>;
};

export type ApiErrorBody = {
  code: string;
  message: string;
  details?: Array<{ field?: string; message: string }>;
};
