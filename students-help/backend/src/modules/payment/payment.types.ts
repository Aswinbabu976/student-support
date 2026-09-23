import type { PaymentProvider, PaymentStatus } from '@prisma/client';

export const PAYMENT_ELIGIBLE_BOOKING_STATUS = 'ACCEPTED' as const;

export const ACTIVE_PAYMENT_STATUSES: PaymentStatus[] = [
  'AUTHORIZATION_PENDING',
  'REQUIRES_PAYMENT_METHOD',
  'AUTHORIZED',
];

export type CreateAuthorizationInput = {
  amountMinor: number;
  platformFeeMinor: number;
  currency: string;
  bookingId: string;
  paymentId: string;
  idempotencyKey: string;
  paymentMethodRef?: string;
};

export type GatewayAuthorizationResult = {
  providerPaymentId: string;
  status: Extract<
    PaymentStatus,
    'AUTHORIZED' | 'REQUIRES_PAYMENT_METHOD' | 'FAILED' | 'CANCELLED'
  >;
  failureCode?: string;
};

export type GatewayCaptureResult = {
  providerPaymentId: string;
  status: Extract<PaymentStatus, 'CAPTURED' | 'FAILED' | 'CANCELLED'>;
  failureCode?: string;
};

export type PublicPaymentView = {
  id: string;
  bookingId: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  amountMinor: number;
  platformFeeMinor: number;
  currency: string;
  authorizedAt: string | null;
  failureCode: string | null;
};

export type AuthorizePaymentInput = {
  paymentMethodRef?: string;
};
