import type {
  PaymentTimelineHeadline,
  PaymentTimelineMapperInput,
  PaymentTimelineStep,
  PaymentTimelineStepStatus,
  PaymentTimelineView,
  TimelineExecutionState,
  TimelinePayoutState,
} from './payment.timeline.types.js';

const ACCEPTED_OR_LATER = new Set([
  'ACCEPTED',
  'CONFIRMED',
  'IN_PROGRESS',
  'AWAITING_SIGNOFF',
  'COMPLETED',
]);

const RELEASED_PAYMENT_STATUSES = new Set(['CAPTURED', 'PAID_OUT', 'PAID', 'SUCCEEDED']);
const FAILED_PAYMENT_STATUSES = new Set(['FAILED', 'CANCELLED']);
const PENDING_PAYMENT_STATUSES = new Set([
  'AUTHORIZATION_PENDING',
  'REQUIRES_PAYMENT_METHOD',
]);

type NormalizedPayment = 'NOT_STARTED' | 'PENDING' | 'AUTHORIZED' | 'FAILED' | 'RELEASED' | 'UNKNOWN';

export function normalizePaymentStatus(status: string | null): NormalizedPayment {
  if (status == null || status === 'NOT_STARTED') {
    return 'NOT_STARTED';
  }
  if (status === 'AUTHORIZED') {
    return 'AUTHORIZED';
  }
  if (FAILED_PAYMENT_STATUSES.has(status)) {
    return 'FAILED';
  }
  if (PENDING_PAYMENT_STATUSES.has(status)) {
    return 'PENDING';
  }
  if (RELEASED_PAYMENT_STATUSES.has(status)) {
    return 'RELEASED';
  }
  return 'UNKNOWN';
}

export function executionStateFromBookingStatus(bookingStatus: string): TimelineExecutionState {
  if (bookingStatus === 'IN_PROGRESS') {
    return 'IN_PROGRESS';
  }
  if (bookingStatus === 'AWAITING_SIGNOFF') {
    return 'AWAITING_SIGNOFF';
  }
  if (bookingStatus === 'COMPLETED') {
    return 'COMPLETED';
  }
  return 'NOT_STARTED';
}

export function payoutStateFromPaymentStatus(paymentStatus: string | null): TimelinePayoutState {
  return normalizePaymentStatus(paymentStatus) === 'RELEASED' ? 'RELEASED' : 'NOT_RELEASED';
}

function step(
  key: PaymentTimelineStep['key'],
  label: string,
  status: PaymentTimelineStepStatus,
  completedAt: string | null,
): PaymentTimelineStep {
  return { key, label, status, completedAt };
}

function displayPaymentStatus(status: string | null, normalized: NormalizedPayment): string {
  if (normalized === 'NOT_STARTED' || status == null) {
    return 'NOT_STARTED';
  }
  if (normalized === 'UNKNOWN') {
    return 'NOT_STARTED';
  }
  return status;
}

function money(amountMinor: number) {
  return { amountMinor };
}

export function buildPaymentTimeline(input: PaymentTimelineMapperInput): PaymentTimelineView {
  const normalized = normalizePaymentStatus(input.paymentStatus);
  const payout: TimelinePayoutState =
    input.payoutState === 'RELEASED' || normalized === 'RELEASED' ? 'RELEASED' : 'NOT_RELEASED';
  const accepted = ACCEPTED_OR_LATER.has(input.bookingStatus);
  const acceptedAt = accepted ? input.acceptedAt : null;

  let headline: PaymentTimelineHeadline;
  let summary: string;
  let acceptedStatus: PaymentTimelineStepStatus = accepted ? 'COMPLETED' : 'UPCOMING';
  let heldStatus: PaymentTimelineStepStatus = 'UPCOMING';
  let doneStatus: PaymentTimelineStepStatus = 'UPCOMING';
  let confirmedStatus: PaymentTimelineStepStatus = 'UPCOMING';
  let paidStatus: PaymentTimelineStepStatus = 'UPCOMING';
  let heldAt: string | null = null;
  let heldLabel = 'Customer payment reserved';
  let doneLabel = 'Task completed';
  let confirmedLabel = 'Customer confirms completion';
  let paidLabel = 'Payment released';

  if (payout === 'RELEASED') {
    headline = 'PAYMENT_RELEASED';
    summary = 'Payment released.';
    acceptedStatus = 'COMPLETED';
    heldStatus = 'COMPLETED';
    doneStatus = 'COMPLETED';
    confirmedStatus = 'COMPLETED';
    paidStatus = 'COMPLETED';
    heldAt = input.authorizedAt;
    heldLabel = 'Customer payment reserved';
  } else if (normalized === 'FAILED') {
    headline = 'PAYMENT_FAILED';
    summary = 'The booking cannot progress until the payment issue is resolved.';
    heldStatus = 'FAILED';
    heldLabel = 'Payment authorization failed';
    heldAt = input.failedAt;
    doneStatus = 'UPCOMING';
    confirmedStatus = 'UPCOMING';
    paidStatus = 'UPCOMING';
  } else if (normalized === 'AUTHORIZED') {
    heldStatus = 'COMPLETED';
    heldAt = input.authorizedAt;
    heldLabel = 'Customer payment reserved';
    if (input.executionState === 'COMPLETED') {
      headline = 'AWAITING_PAYOUT';
      summary = 'Payment will be released after capture. The Help Seeker has confirmed completion.';
      doneStatus = 'COMPLETED';
      confirmedStatus = 'COMPLETED';
      paidStatus = 'CURRENT';
      paidLabel = 'Waiting for payment release';
    } else if (input.executionState === 'AWAITING_SIGNOFF') {
      headline = 'AWAITING_CONFIRMATION';
      summary = 'Payment will be released after the Help Seeker confirms completion.';
      doneStatus = 'COMPLETED';
      confirmedStatus = 'CURRENT';
      confirmedLabel = 'Waiting for customer confirmation';
    } else if (input.executionState === 'IN_PROGRESS') {
      headline = 'PAYMENT_RESERVED';
      summary =
        'The customer payment has been authorized for this booking. Payment will be released after the Help Seeker confirms completion.';
      doneStatus = 'CURRENT';
      doneLabel = 'Task in progress';
    } else {
      headline = 'PAYMENT_RESERVED';
      summary =
        'The customer payment has been authorized for this booking. Payment will be released after the Help Seeker confirms completion.';
      doneStatus = 'CURRENT';
      doneLabel = 'Complete the task';
    }
  } else {
    headline = 'PAYMENT_PENDING';
    summary = 'The Help Seeker still needs to authorize payment before the booking can move forward.';
    if (accepted) {
      heldStatus = 'CURRENT';
      heldLabel = 'Waiting for payment authorization';
    }
  }

  const timeline: PaymentTimelineStep[] = [
    step('ACCEPTED', 'Booking accepted', acceptedStatus, acceptedStatus === 'COMPLETED' ? acceptedAt : null),
    step('HELD', heldLabel, heldStatus, heldStatus === 'COMPLETED' || heldStatus === 'FAILED' ? heldAt : null),
    step('DONE', doneLabel, doneStatus, null),
    step('CONFIRMED', confirmedLabel, confirmedStatus, null),
    step('PAID', paidLabel, paidStatus, null),
  ];

  return {
    bookingId: input.bookingId,
    currency: input.currency,
    paymentStatus: displayPaymentStatus(input.paymentStatus, normalized),
    headline,
    summary,
    estimatedEarnings: money(input.taskAmountMinor),
    taskAmount: money(input.taskAmountMinor),
    platformFee: money(input.platformFeeMinor),
    customerTotal: money(input.customerTotalMinor),
    timeline,
  };
}
