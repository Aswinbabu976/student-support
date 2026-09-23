import { z } from 'zod';
import { normalizeEmail } from '../../auth/schemas/email';
import { getPasswordPolicyMessage, isPasswordPolicySatisfied } from '../../auth/schemas/password-policy';
import { PREFERRED_PAYMENT_METHODS } from '../types';

export { normalizeEmail };

export const helpSeekerRegisterSchema = z
  .object({
    fullName: z.string().trim().min(1, 'Full name is required.').max(100, 'Full name must be 100 characters or fewer.'),
    email: z
      .string()
      .trim()
      .min(1, 'Email is required.')
      .check(z.email('Enter a valid email address.')),
    phone: z.string().trim().min(1, 'Phone number is required.'),
    address: z
      .string()
      .trim()
      .min(8, 'Enter a street address with city or postal details.')
      .max(200, 'Address must be 200 characters or fewer.'),
    preferredPaymentMethod: z.string().min(1, 'Preferred payment method is required.'),
    password: z.string().min(1, 'Password is required.'),
    confirmPassword: z.string().min(1, 'Confirm your password.'),
  })
  .superRefine((value, ctx) => {
    const phone = value.phone.replace(/[().\s-]/g, '');
    if (!/^\+?[0-9]{8,15}$/.test(phone)) {
      ctx.addIssue({
        code: 'custom',
        path: ['phone'],
        message: 'Enter a valid phone number including country code if possible.',
      });
    }
    if (!PREFERRED_PAYMENT_METHODS.includes(value.preferredPaymentMethod as (typeof PREFERRED_PAYMENT_METHODS)[number])) {
      ctx.addIssue({
        code: 'custom',
        path: ['preferredPaymentMethod'],
        message: 'Choose a supported payment preference.',
      });
    }
    if (!isPasswordPolicySatisfied(value.password)) {
      ctx.addIssue({
        code: 'custom',
        path: ['password'],
        message: getPasswordPolicyMessage(),
      });
    }
    if (value.password !== value.confirmPassword) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        message: 'Passwords do not match.',
      });
    }
  });

export type HelpSeekerRegisterValues = z.infer<typeof helpSeekerRegisterSchema>;
