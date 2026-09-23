import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../services/api/client';
import { getCostEstimate } from '../../pricing/services/pricing-api';
import type { CostEstimate } from '../../pricing/types';
import { authorizePayment, getPayment } from '../services/payment-api';
import type { PaymentView } from '../types';
import { PaymentAuthorization } from './PaymentAuthorization';

vi.mock('../services/payment-api', () => ({
  getPayment: vi.fn(),
  authorizePayment: vi.fn(),
}));

vi.mock('../../pricing/services/pricing-api', () => ({
  getCostEstimate: vi.fn(),
}));

const mockedGetPayment = vi.mocked(getPayment);
const mockedAuthorize = vi.mocked(authorizePayment);
const mockedCost = vi.mocked(getCostEstimate);

const estimate: CostEstimate = {
  currency: 'EUR',
  estimatedDurationMinutes: 180,
  estimatedHours: 3,
  baseHourlyRate: { amountMinor: 1500 },
  subtotal: { amountMinor: 4500 },
  platformFee: { amountMinor: 450 },
  total: { amountMinor: 4950 },
};

const authorizedPayment: PaymentView = {
  id: 'pay_1',
  bookingId: 'booking_1',
  provider: 'MOCK',
  status: 'AUTHORIZED',
  amountMinor: 4950,
  platformFeeMinor: 450,
  currency: 'EUR',
  authorizedAt: '2026-09-11T10:00:00.000Z',
  failureCode: null,
};

describe('PaymentAuthorization', () => {
  beforeEach(() => {
    mockedGetPayment.mockReset();
    mockedAuthorize.mockReset();
    mockedCost.mockResolvedValue({ estimate });
    mockedGetPayment.mockResolvedValue({ payment: null });
  });

  it('shows the payment section and estimated total for an eligible booking', async () => {
    render(<PaymentAuthorization bookingId="booking_1" taskId="task_1" />);
    expect(await screen.findByRole('heading', { name: 'Payment' })).toBeInTheDocument();
    expect(await screen.findByText('Estimated total €49.50')).toBeInTheDocument();
    expect(
      screen.getByText('Payment authorization is required before this booking can be confirmed.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue to Payment' })).toBeEnabled();
    expect(screen.queryByText(/funds were reserved/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Payment authorized')).not.toBeInTheDocument();
  });

  it('calls the authorization API and prevents a second submit while preparing', async () => {
    const user = userEvent.setup();
    let resolveAuthorize: ((value: { payment: PaymentView }) => void) | undefined;
    mockedAuthorize.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAuthorize = resolve;
        }),
    );
    render(<PaymentAuthorization bookingId="booking_1" taskId="task_1" />);
    const button = await screen.findByRole('button', { name: 'Continue to Payment' });
    await user.click(button);
    expect(screen.getByRole('button', { name: 'Preparing payment...' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Preparing payment...' }));
    expect(mockedAuthorize).toHaveBeenCalledTimes(1);
    expect(mockedAuthorize).toHaveBeenCalledWith('booking_1');
    resolveAuthorize?.({ payment: authorizedPayment });
    expect(
      await screen.findByText(
        'Payment authorized in the test environment. No funds were reserved at a payment network.',
      ),
    ).toBeInTheDocument();
  });

  it('renders authorized only from a backend result', async () => {
    mockedGetPayment.mockResolvedValue({ payment: authorizedPayment });
    render(<PaymentAuthorization bookingId="booking_1" taskId="task_1" />);
    expect(
      await screen.findByText(
        'Payment authorized in the test environment. No funds were reserved at a payment network.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue to Payment' })).not.toBeInTheDocument();
  });

  it('renders a failure state from the API', async () => {
    const user = userEvent.setup();
    mockedAuthorize.mockRejectedValue(
      new ApiError(409, {
        code: 'PAYMENT_AUTHORIZATION_FAILED',
        message: 'Payment authorization was declined.',
        details: [],
      }),
    );
    mockedGetPayment
      .mockResolvedValueOnce({ payment: null })
      .mockResolvedValueOnce({
        payment: {
          ...authorizedPayment,
          status: 'FAILED',
          authorizedAt: null,
          failureCode: 'DECLINED',
        },
      });
    render(<PaymentAuthorization bookingId="booking_1" taskId="task_1" />);
    await user.click(await screen.findByRole('button', { name: 'Continue to Payment' }));
    expect(await screen.findByText('Payment authorization was declined.')).toBeInTheDocument();
    expect(screen.getByText('Payment authorization failed')).toBeInTheDocument();
    expect(
      screen.queryByText(/Payment authorized in the test environment/i),
    ).not.toBeInTheDocument();
  });
});
