import { z } from 'zod';
import { getPasswordPolicyMessage, isPasswordPolicySatisfied } from './password-policy';

export { getPasswordPolicyMessage, isPasswordPolicySatisfied, PASSWORD_POLICY } from './password-policy';
export { normalizeEmail } from './email';

export const studentRegisterSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, 'University email is required.')
      .check(z.email('Enter a valid email address.')),
    password: z.string().min(1, 'Password is required.'),
    confirmPassword: z.string().min(1, 'Confirm your password.'),
  })
  .superRefine((value, ctx) => {
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

export type StudentRegisterValues = z.infer<typeof studentRegisterSchema>;

