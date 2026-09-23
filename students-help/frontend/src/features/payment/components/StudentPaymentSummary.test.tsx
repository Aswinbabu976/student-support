import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../services/api/client';
import { getPaymentTimeline } from '../services/payment-api';
import type { PaymentTimelineView } from '../types';
import { StudentPaymentSummary } from './StudentPaymentSummary';

vi.mock('../services/payment-api', () => ({
  getPaymentTimeline: vi.fn(),
  getPayment: vi.fn(),
  authorizePayment: vi.fn(),
}));

const mocked = vi.mocked(getPaymentTimeline);

const pendingTimeline: PaymentTimelineView = {
  bookingId: 'booking_1',
  currency: 'EUR',
  paymentStatus: 'NOT_STARTED',
  headline: 'PAYMENT_PENDING',
  summary: 'The Help Seeker still needs to authorize payment before the booking can move forward.',
  estimatedEarnings: { amountMinor: 4500 },
  taskAmount: { amountMinor: 4500 },
  platformFee: { amountMinor: 450 },
  customerTotal: { amountMinor: 4950 },
  timeline: [
    { key: 'ACCEPTED', label: 'Booking accepted', status: 'COMPLETED', completedAt: '2026-09-11T10:00:00.000Z' },
    { key: 'HELD', label: 'Waiting for payment authorization', status: 'CURRENT', completedAt: null },
    { key: 'DONE', label: 'Task completed', status: 'UPCOMING', completedAt: null },
    { key: 'CONFIRMED', label: 'Customer confirms completion', status: 'UPCOMING', completedAt: null },
    { key: 'PAID', label: 'Payment released', status: 'UPCOMING', completedAt: null },
  ],
};

const reservedTimeline: PaymentTimelineView = {
  ...pendingTimeline,
  paymentStatus: 'AUTHORIZED',
  headline: 'PAYMENT_RESERVED',
  summary:
    'The customer payment has been authorized for this booking. Payment will be released after the Help Seeker confirms completion.',
  timeline: [
    { key: 'ACCEPTED', label: 'Booking accepted', status: 'COMPLETED', completedAt: '2026-09-11T10:00:00.000Z' },
    {
      key: 'HELD',
      label: 'Customer payment reserved',
      status: 'COMPLETED',
      completedAt: '2026-09-11T10:05:00.000Z',
    },
    { key: 'DONE', label: 'Complete the task', status: 'CURRENT', completedAt: null },
    { key: 'CONFIRMED', label: 'Customer confirms completion', status: 'UPCOMING', completedAt: null },
    { key: 'PAID', label: 'Payment released', status: 'UPCOMING', completedAt: null },
  ],
};

const failedTimeline: PaymentTimelineView = {
  ...pendingTimeline,
  paymentStatus: 'FAILED',
  headline: 'PAYMENT_FAILED',
  summary: 'The booking cannot progress until the payment issue is resolved.',
  timeline: [
    { key: 'ACCEPTED', label: 'Booking accepted', status: 'COMPLETED', completedAt: null },
    { key: 'HELD', label: 'Payment authorization failed', status: 'FAILED', completedAt: null },
    { key: 'DONE', label: 'Task completed', status: 'UPCOMING', completedAt: null },
    { key: 'CONFIRMED', label: 'Customer confirms completion', status: 'UPCOMING', completedAt: null },
    { key: 'PAID', label: 'Payment released', status: 'UPCOMING', completedAt: null },
  ],
};

const releasedTimeline: PaymentTimelineView = {
  ...pendingTimeline,
  paymentStatus: 'CAPTURED',
  headline: 'PAYMENT_RELEASED',
  summary: 'Payment released.',
  timeline: [
    { key: 'ACCEPTED', label: 'Booking accepted', status: 'COMPLETED', completedAt: '2026-09-11T10:00:00.000Z' },
    { key: 'HELD', label: 'Customer payment reserved', status: 'COMPLETED', completedAt: '2026-09-11T10:05:00.000Z' },
    { key: 'DONE', label: 'Task completed', status: 'COMPLETED', completedAt: null },
    { key: 'CONFIRMED', label: 'Customer confirms completion', status: 'COMPLETED', completedAt: null },
    { key: 'PAID', label: 'Payment released', status: 'COMPLETED', completedAt: null },
  ],
};

describe('StudentPaymentSummary', () => {
  beforeEach(() => {
    mocked.mockReset();
  });

  it('shows a loading state before the timeline arrives', async () => {
    let resolveTimeline: ((value: { paymentTimeline: PaymentTimelineView }) => void) | undefined;
    mocked.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveTimeline = resolve;
        }),
    );
    render(<StudentPaymentSummary bookingId="booking_1" />);
    expect(screen.getByText('Loading payment…')).toBeInTheDocument();
    resolveTimeline?.({ paymentTimeline: pendingTimeline });
    expect(await screen.findByText('Payment pending')).toBeInTheDocument();
    expect(screen.queryByText('Loading payment…')).not.toBeInTheDocument();
  });

  it('renders a payment-pending timeline and expected earnings from the API', async () => {
    mocked.mockResolvedValue({ paymentTimeline: pendingTimeline });
    const { container } = render(<StudentPaymentSummary bookingId="booking_1" />);

    expect(await screen.findByRole('heading', { name: 'Payment' })).toBeInTheDocument();
    expect(screen.getByText('Expected earnings')).toBeInTheDocument();
    expect(screen.getAllByText('€45.00').length).toBeGreaterThan(0);
    expect(screen.getByText('€4.50')).toBeInTheDocument();
    expect(screen.getByText('Payment pending')).toBeInTheDocument();
    expect(screen.getByText('Waiting for payment authorization')).toBeInTheDocument();
    expect(screen.getByText('Booking accepted')).toBeInTheDocument();
    expect(screen.queryByText('Complete the task')).not.toBeInTheDocument();
    expect(screen.queryByText('requires_capture')).not.toBeInTheDocument();
    expect(container.querySelector('ol.payment-timeline__list')).not.toBeNull();
    expect(screen.getByText(/Step 2 of 5, Waiting for payment authorization, current/)).toBeInTheDocument();
  });

  it('renders a reserved/held timeline from backend AUTHORIZED state', async () => {
    mocked.mockResolvedValue({ paymentTimeline: reservedTimeline });
    render(<StudentPaymentSummary bookingId="booking_1" />);
    expect(await screen.findByText('Payment reserved')).toBeInTheDocument();
    expect(screen.getByText('Customer payment reserved')).toBeInTheDocument();
    expect(screen.getByText('Complete the task')).toBeInTheDocument();
    expect(screen.getAllByText('Upcoming').length).toBeGreaterThan(0);
  });

  it('renders a failed payment state without a student retry control', async () => {
    mocked.mockResolvedValue({ paymentTimeline: failedTimeline });
    render(<StudentPaymentSummary bookingId="booking_1" />);
    expect((await screen.findAllByText('Payment authorization failed')).length).toBeGreaterThan(0);
    expect(screen.getByText('The booking cannot progress until the payment issue is resolved.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pay/i })).not.toBeInTheDocument();
  });

  it('renders paid/released only from a backend released headline', async () => {
    mocked.mockResolvedValue({ paymentTimeline: releasedTimeline });
    render(<StudentPaymentSummary bookingId="booking_1" />);
    expect(await screen.findAllByText('Payment released')).toHaveLength(2);
    expect(screen.queryByText('Payment pending')).not.toBeInTheDocument();
  });

  it('does not crash when optional timestamps are missing', async () => {
    mocked.mockResolvedValue({
      paymentTimeline: {
        ...pendingTimeline,
        timeline: pendingTimeline.timeline.map((step) => ({ ...step, completedAt: null })),
      },
    });
    render(<StudentPaymentSummary bookingId="booking_1" />);
    expect(await screen.findByText('Booking accepted')).toBeInTheDocument();
    expect(screen.getByText('Payment pending')).toBeInTheDocument();
  });

  it('renders an API error state', async () => {
    mocked.mockRejectedValue(
      new ApiError(502, {
        code: 'PAYMENT_TIMELINE_UNAVAILABLE',
        message: 'We could not load payment information right now.',
        details: [],
      }),
    );
    render(<StudentPaymentSummary bookingId="booking_1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't load payment information right now.",
    );
    expect(screen.queryByText('Payment pending')).not.toBeInTheDocument();
  });
});
