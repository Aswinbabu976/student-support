import { apiRequest } from '../../../services/api/client';
import type {
  HelpSeekerAccountResponse,
  HelpSeekerRegistrationResponse,
  PreferredPaymentMethod,
} from '../../help-seeker/types';
import type {
  EmailVerificationResponse,
  RegistrationConfig,
  StudentRegistrationResponse,
} from '../types/auth';

export function getRegistrationConfig(): Promise<RegistrationConfig> {
  return apiRequest<RegistrationConfig>('/auth/registration-config');
}

export function registerStudent(input: {
  email: string;
  password: string;
}): Promise<StudentRegistrationResponse> {
  return apiRequest<StudentRegistrationResponse>('/auth/register/student', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      password: input.password,
    }),
  });
}

export function registerHelpSeeker(input: {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  preferredPaymentMethod: PreferredPaymentMethod;
  password: string;
}): Promise<HelpSeekerRegistrationResponse> {
  return apiRequest<HelpSeekerRegistrationResponse>('/auth/register/help-seeker', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getHelpSeekerAccount(): Promise<HelpSeekerAccountResponse> {
  return apiRequest<HelpSeekerAccountResponse>('/help-seeker/account');
}

export function login(input: { email: string; password: string }) {
  return apiRequest<{
    user: { id: string; email: string; role: string };
    session: { expiresAt: string };
  }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function verifyStudentEmail(token: string): Promise<EmailVerificationResponse> {
  return apiRequest<EmailVerificationResponse>('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}
