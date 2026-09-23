import { PreferredPaymentMethod } from '@prisma/client';
import { z } from 'zod';
import { accountEmailSchema, assertPasswordPolicy } from '../auth/auth.validation.js';
import { invalidPaymentMethod, validationError } from '../../shared/errors.js';

const PAYMENT_METHODS = new Set<string>(Object.values(PreferredPaymentMethod));

const phoneSchema = z
  .string({ error: 'Phone number is required.' })
  .trim()
  .min(1, 'Phone number is required.');

export const helpSeekerRegistrationSchema = z
  .object({
    fullName: z
      .string({ error: 'Full name is required.' })
      .trim()
      .min(1, 'Full name is required.')
      .max(100, 'Full name must be 100 characters or fewer.'),
    email: accountEmailSchema,
    phone: phoneSchema,
    address: z
      .string({ error: 'Address is required.' })
      .trim()
      .min(8, 'Enter a street address with city or postal details.')
      .max(200, 'Address must be 200 characters or fewer.'),
    preferredPaymentMethod: z
      .string({ error: 'Preferred payment method is required.' })
      .trim()
      .min(1, 'Preferred payment method is required.'),
    password: z
      .string({ error: 'Password is required.' })
      .min(1, 'Password is required.'),
  })
  .strict();

export type HelpSeekerRegistrationInput = z.infer<typeof helpSeekerRegistrationSchema> & {
  preferredPaymentMethod: PreferredPaymentMethod;
  phone: string;
};

export function normalizePhone(phone: string): string {
  return phone.trim().replace(/[().\s-]/g, '');
}

export function parseHelpSeekerRegistration(body: unknown): HelpSeekerRegistrationInput {
  const parsed = helpSeekerRegistrationSchema.parse(body);
  assertPasswordPolicy(parsed.password);

  const phone = normalizePhone(parsed.phone);
  if (!/^\+?[0-9]{8,15}$/.test(phone)) {
    throw validationError('The submitted data is invalid.', [
      { field: 'phone', message: 'Enter a valid phone number including country code if possible.' },
    ]);
  }

  if (!PAYMENT_METHODS.has(parsed.preferredPaymentMethod)) {
    throw invalidPaymentMethod();
  }

  return {
    ...parsed,
    phone,
    preferredPaymentMethod: parsed.preferredPaymentMethod as PreferredPaymentMethod,
  };
}
