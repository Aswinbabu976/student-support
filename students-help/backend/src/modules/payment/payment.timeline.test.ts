import { describe, expect, it } from 'vitest';
import {
  buildPaymentTimeline,
  executionStateFromBookingStatus,
  normalizePaymentStatus,
  payoutStateFromPaymentStatus,
} from './payment.timeline.js';
import type { PaymentTimelineMapperInput } from './payment.timeline.types.js';

const base: PaymentTimelineMapperInput = {
  bookingId: 'booking_1',
  bookingStatus: 'ACCEPTED',
  acceptedAt: '2026-09-11T10:00:00.000Z',
  paymentStatus: null,
  authorizedAt: null,
  failedAt: null,
  currency: 'EUR',
  taskAmountMinor: 4500,
  platformFeeMinor: 450,
  customerTotalMinor: 4950,
  executionState: 'NOT_STARTED',
  payoutState: 'NOT_RELEASED',
};

function keys(input: PaymentTimelineMapperInput = base) {
  return buildPaymentTimeline(input).timeline.map((step) => step.key);
}

function statuses(input: PaymentTimelineMapperInput) {
  return buildPaymentTimeline(input).timeline.map((step) => `${step.key}:${step.status}`);
}

describe('payment timeline mapper', () => {
  it('keeps a deterministic Accepted → Held → Done → Confirmed → Paid order', () => {
    expect(keys()).toEqual(['ACCEPTED', 'HELD', 'DONE', 'CONFIRMED', 'PAID']);
  });

  it('maps ACCEPTED with no payment to payment-pending', () => {
    const view = buildPaymentTimeline(base);
    expect(view.headline).toBe('PAYMENT_PENDING');
    expect(view.paymentStatus).toBe('NOT_STARTED');
    expect(view.currency).toBe('EUR');
    expect(view.estimatedEarnings.amountMinor).toBe(4500);
    expect(view.taskAmount.amountMinor).toBe(4500);
    expect(view.platformFee.amountMinor).toBe(450);
    expect(view.customerTotal.amountMinor).toBe(4950);
    expect(statuses(base)).toEqual([
      'ACCEPTED:COMPLETED',
      'HELD:CURRENT',
      'DONE:UPCOMING',
      'CONFIRMED:UPCOMING',
      'PAID:UPCOMING',
    ]);
    expect(view.timeline[1]?.label).toBe('Waiting for payment authorization');
    expect(view.timeline[1]?.completedAt).toBeNull();
  });

  it('maps AUTHORIZED payment to reserved / held without claiming payout', () => {
    const view = buildPaymentTimeline({
      ...base,
      paymentStatus: 'AUTHORIZED',
      authorizedAt: '2026-09-11T10:05:00.000Z',
    });
    expect(view.headline).toBe('PAYMENT_RESERVED');
    expect(view.paymentStatus).toBe('AUTHORIZED');
    expect(statuses({
      ...base,
      paymentStatus: 'AUTHORIZED',
      authorizedAt: '2026-09-11T10:05:00.000Z',
    })).toEqual([
      'ACCEPTED:COMPLETED',
      'HELD:COMPLETED',
      'DONE:CURRENT',
      'CONFIRMED:UPCOMING',
      'PAID:UPCOMING',
    ]);
    expect(view.timeline[1]?.label).toBe('Customer payment reserved');
    expect(view.timeline[1]?.completedAt).toBe('2026-09-11T10:05:00.000Z');
    expect(view.timeline[4]?.status).toBe('UPCOMING');
  });

  it('maps failed authorization without advancing later steps', () => {
    const view = buildPaymentTimeline({
      ...base,
      paymentStatus: 'FAILED',
      failedAt: '2026-09-11T10:06:00.000Z',
    });
    expect(view.headline).toBe('PAYMENT_FAILED');
    expect(statuses({
      ...base,
      paymentStatus: 'FAILED',
      failedAt: '2026-09-11T10:06:00.000Z',
    })).toEqual([
      'ACCEPTED:COMPLETED',
      'HELD:FAILED',
      'DONE:UPCOMING',
      'CONFIRMED:UPCOMING',
      'PAID:UPCOMING',
    ]);
    expect(view.timeline[1]?.label).toBe('Payment authorization failed');
    expect(view.timeline[1]?.completedAt).toBe('2026-09-11T10:06:00.000Z');
  });

  it('maps IN_PROGRESS to Task in progress without advancing customer confirmation', () => {
    const view = buildPaymentTimeline({
      ...base,
      bookingStatus: 'IN_PROGRESS',
      paymentStatus: 'AUTHORIZED',
      authorizedAt: '2026-09-11T10:05:00.000Z',
      executionState: 'IN_PROGRESS',
    });
    expect(view.headline).toBe('PAYMENT_RESERVED');
    expect(view.timeline.find((step) => step.key === 'DONE')?.status).toBe('CURRENT');
    expect(view.timeline.find((step) => step.key === 'DONE')?.label).toBe('Task in progress');
    expect(view.timeline.find((step) => step.key === 'CONFIRMED')?.status).toBe('UPCOMING');
    expect(view.timeline.find((step) => step.key === 'PAID')?.status).toBe('UPCOMING');
  });

  it('maps task submitted for sign-off without advancing payment release', () => {
    const view = buildPaymentTimeline({
      ...base,
      bookingStatus: 'AWAITING_SIGNOFF',
      paymentStatus: 'AUTHORIZED',
      authorizedAt: '2026-09-11T10:05:00.000Z',
      executionState: 'AWAITING_SIGNOFF',
    });
    expect(view.headline).toBe('AWAITING_CONFIRMATION');
    expect(view.paymentStatus).toBe('AUTHORIZED');
    expect(view.timeline.find((step) => step.key === 'DONE')).toMatchObject({
      status: 'COMPLETED',
      label: 'Task completed',
    });
    expect(view.timeline.find((step) => step.key === 'CONFIRMED')).toMatchObject({
      status: 'CURRENT',
      label: 'Waiting for customer confirmation',
    });
    expect(view.timeline.find((step) => step.key === 'PAID')?.status).toBe('UPCOMING');
  });

  it('maps task completed to Done completed and Confirmed current', () => {
    expect(
      statuses({
        ...base,
        paymentStatus: 'AUTHORIZED',
        authorizedAt: '2026-09-11T10:05:00.000Z',
        executionState: 'AWAITING_SIGNOFF',
      }),
    ).toEqual([
      'ACCEPTED:COMPLETED',
      'HELD:COMPLETED',
      'DONE:COMPLETED',
      'CONFIRMED:CURRENT',
      'PAID:UPCOMING',
    ]);
  });

  it('does not mark Paid complete when the task is done but payment is still only authorized', () => {
    const view = buildPaymentTimeline({
      ...base,
      bookingStatus: 'COMPLETED',
      paymentStatus: 'AUTHORIZED',
      authorizedAt: '2026-09-11T10:05:00.000Z',
      executionState: 'COMPLETED',
    });
    expect(view.headline).toBe('AWAITING_PAYOUT');
    expect(view.timeline.find((step) => step.key === 'PAID')?.status).toBe('CURRENT');
    expect(view.timeline.find((step) => step.key === 'PAID')?.status).not.toBe('COMPLETED');
  });

  it('maps a real released/captured payment to Paid completed', () => {
    const view = buildPaymentTimeline({
      ...base,
      paymentStatus: 'CAPTURED',
      authorizedAt: '2026-09-11T10:05:00.000Z',
      executionState: 'COMPLETED',
      payoutState: 'RELEASED',
    });
    expect(view.headline).toBe('PAYMENT_RELEASED');
    expect(statuses({
      ...base,
      paymentStatus: 'CAPTURED',
      authorizedAt: '2026-09-11T10:05:00.000Z',
      executionState: 'COMPLETED',
      payoutState: 'RELEASED',
    })).toEqual([
      'ACCEPTED:COMPLETED',
      'HELD:COMPLETED',
      'DONE:COMPLETED',
      'CONFIRMED:COMPLETED',
      'PAID:COMPLETED',
    ]);
  });

  it('does not treat Booking CONFIRMED as customer sign-off or payout', () => {
    const view = buildPaymentTimeline({
      ...base,
      bookingStatus: 'CONFIRMED',
      paymentStatus: 'AUTHORIZED',
      authorizedAt: '2026-09-11T10:05:00.000Z',
      executionState: 'NOT_STARTED',
    });
    expect(view.headline).toBe('PAYMENT_RESERVED');
    expect(view.timeline.find((step) => step.key === 'CONFIRMED')?.status).toBe('UPCOMING');
    expect(view.timeline.find((step) => step.key === 'PAID')?.status).toBe('UPCOMING');
  });

  it('handles missing optional timestamps without throwing', () => {
    const view = buildPaymentTimeline({
      ...base,
      acceptedAt: null,
      authorizedAt: null,
      failedAt: null,
      paymentStatus: 'AUTHORIZED',
    });
    expect(view.timeline[0]?.completedAt).toBeNull();
    expect(view.timeline[1]?.completedAt).toBeNull();
  });

  it('does not treat raw provider status as reserved', () => {
    const view = buildPaymentTimeline({
      ...base,
      paymentStatus: 'requires_capture',
    });
    expect(normalizePaymentStatus('requires_capture')).toBe('UNKNOWN');
    expect(view.headline).toBe('PAYMENT_PENDING');
    expect(view.paymentStatus).toBe('NOT_STARTED');
    expect(view.timeline.find((step) => step.key === 'HELD')?.status).toBe('CURRENT');
    expect(view.timeline.find((step) => step.key === 'HELD')?.label).toBe(
      'Waiting for payment authorization',
    );
  });

  it('derives execution and payout from known domain values only', () => {
    expect(executionStateFromBookingStatus('ACCEPTED')).toBe('NOT_STARTED');
    expect(executionStateFromBookingStatus('CONFIRMED')).toBe('NOT_STARTED');
    expect(executionStateFromBookingStatus('COMPLETED')).toBe('COMPLETED');
    expect(payoutStateFromPaymentStatus('AUTHORIZED')).toBe('NOT_RELEASED');
    expect(payoutStateFromPaymentStatus('CAPTURED')).toBe('RELEASED');
  });
});
