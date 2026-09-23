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

export type StudentPaymentStatus = 'NOT_STARTED' | string;

export type PaymentTimelineView = {
  bookingId: string;
  currency: string;
  paymentStatus: StudentPaymentStatus;
  headline: PaymentTimelineHeadline;
  summary: string;
  estimatedEarnings: PaymentTimelineMoney;
  taskAmount: PaymentTimelineMoney;
  platformFee: PaymentTimelineMoney;
  customerTotal: PaymentTimelineMoney;
  timeline: PaymentTimelineStep[];
};

/**
 * Forward-compatible execution signals. Task start/completion/sign-off are not
 * implemented yet; the mapper understands these values so later members can
 * feed real states without changing presentation rules.
 */
export type TimelineExecutionState = 'NOT_STARTED' | 'IN_PROGRESS' | 'AWAITING_SIGNOFF' | 'COMPLETED';

export type TimelinePayoutState = 'NOT_RELEASED' | 'RELEASED';

export type PaymentTimelineMapperInput = {
  bookingId: string;
  bookingStatus: string;
  acceptedAt: string | null;
  paymentStatus: string | null;
  authorizedAt: string | null;
  failedAt: string | null;
  currency: string;
  taskAmountMinor: number;
  platformFeeMinor: number;
  customerTotalMinor: number;
  executionState: TimelineExecutionState;
  payoutState: TimelinePayoutState;
};
