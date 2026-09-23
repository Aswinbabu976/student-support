import { z } from 'zod';
import { validationError } from '../../shared/errors.js';
import type { AuthorizePaymentInput } from './payment.types.js';

const authorizePaymentSchema = z
  .object({
    paymentMethodRef: z.string().max(128).optional(),
  })
  .strict();

export function parseAuthorizePayment(body: unknown): AuthorizePaymentInput {
  const parsed = authorizePaymentSchema.parse(body ?? {});
  const paymentMethodRef = parsed.paymentMethodRef?.trim();
  if (parsed.paymentMethodRef !== undefined && !paymentMethodRef) {
    throw validationError('The submitted data is invalid.', [
      { field: 'paymentMethodRef', message: 'Payment method reference is invalid.' },
    ]);
  }
  return paymentMethodRef ? { paymentMethodRef } : {};
}
