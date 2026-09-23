export type PaymentStatus =
  | 'AUTHORIZATION_PENDING'
  | 'REQUIRES_PAYMENT_METHOD'
  | 'AUTHORIZED'
  | 'CAPTURED'
  | 'FAILED'
  | 'CANCELLED';

export type PaymentProvider = 'MOCK' | 'STRIPE';

export type PaymentView = {
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

export type PaymentResponse = {
  payment: PaymentView | null;
};

export type PaymentTimelineStepKey = 'ACCEPTED' | 'HELD' | 'DONE' | 'CONFIRMED' | 'PAID';
export type PaymentTimelineStepStatus = 'COMPLETED' | 'CURRENT' | 'UPCOMING' | 'FAILED';
export type PaymentTimelineHeadline =
  | 'PAYMENT_PENDING'
  | 'PAYMENT_RESERVED'
  | 'PAYMENT_FAILED'
  | 'AWAITING_CONFIRMATION'
  | 'AWAITING_PAYOUT'
  | 'PAYMENT_RELEASED';

export type PaymentTimelineMoney = {
  amountMinor: number;
};

export type PaymentTimelineStep = {
  key: PaymentTimelineStepKey;
  label: string;
  status: PaymentTimelineStepStatus;
  completedAt: string | null;
};

export type PaymentTimelineView = {
  bookingId: string;
  currency: string;
  paymentStatus: string;
  headline: PaymentTimelineHeadline;
  summary: string;
  estimatedEarnings: PaymentTimelineMoney;
  taskAmount: PaymentTimelineMoney;
  platformFee: PaymentTimelineMoney;
  customerTotal: PaymentTimelineMoney;
  timeline: PaymentTimelineStep[];
};

export type PaymentTimelineResponse = {
  paymentTimeline: PaymentTimelineView;
};
