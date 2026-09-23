import { z } from 'zod';
import {
  getPasswordPolicyMessage,
  isPasswordPolicySatisfied,
} from '../../config/password-policy.js';
import { validationError } from '../../shared/errors.js';

export const accountEmailSchema = z
  .string({ error: 'Email is required.' })
  .trim()
  .min(1, 'Email is required.')
  .check(z.email('Enter a valid email address.'));

const universityEmailSchema = z
  .string({ error: 'University email is required.' })
  .trim()
  .min(1, 'University email is required.')
  .check(z.email('Enter a valid email address.'));

const passwordSchema = z
  .string({ error: 'Password is required.' })
  .min(1, 'Password is required.');

export const studentRegistrationSchema = z
  .object({
    email: universityEmailSchema,
    password: passwordSchema,
  })
  .strict();

export const emailVerificationSchema = z
  .object({
    token: z
      .string({ error: 'Verification token is required.' })
      .trim()
      .min(1, 'Verification token is required.'),
  })
  .strict();

export const loginSchema = z
  .object({
    email: accountEmailSchema,
    password: passwordSchema,
  })
  .strict();

export type StudentRegistrationInput = z.infer<typeof studentRegistrationSchema>;
export type EmailVerificationInput = z.infer<typeof emailVerificationSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export function assertPasswordPolicy(password: string): void {
  if (!isPasswordPolicySatisfied(password)) {
    throw validationError('The submitted data is invalid.', [
      { field: 'password', message: getPasswordPolicyMessage() },
    ]);
  }
}

export function parseStudentRegistration(body: unknown): StudentRegistrationInput {
  const parsed = studentRegistrationSchema.parse(body);
  assertPasswordPolicy(parsed.password);
  return parsed;
}

export function parseEmailVerification(input: unknown): EmailVerificationInput {
  return emailVerificationSchema.parse(input);
}

export function parseLogin(body: unknown): LoginInput {
  return loginSchema.parse(body);
}
