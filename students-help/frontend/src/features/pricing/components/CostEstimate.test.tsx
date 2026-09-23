import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../services/api/client';
import { getCostEstimate } from '../services/pricing-api';
import type { CostEstimate } from '../types';
import { CostEstimate as CostEstimateView } from './CostEstimate';

vi.mock('../services/pricing-api', () => ({
  getCostEstimate: vi.fn(),
}));

const mocked = vi.mocked(getCostEstimate);

describe('CostEstimate', () => {
  beforeEach(() => {
    mocked.mockReset();
  });

  it('shows a loading state before the estimate arrives', async () => {
    let resolveEstimate: ((value: { estimate: CostEstimate }) => void) | undefined;
    mocked.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveEstimate = resolve;
        }),
    );
    render(<CostEstimateView taskId="task_1" />);
    expect(screen.getByText('Loading estimate…')).toBeInTheDocument();
    resolveEstimate?.({
      estimate: {
        currency: 'EUR',
        estimatedDurationMinutes: 180,
        estimatedHours: 3,
        baseHourlyRate: { amountMinor: 1500 },
        subtotal: { amountMinor: 4500 },
        platformFee: { amountMinor: 450 },
        total: { amountMinor: 4950 },
      },
    });
    expect(await screen.findByText('€15.00')).toBeInTheDocument();
    expect(screen.queryByText('Loading estimate…')).not.toBeInTheDocument();
  });

  it('renders the transparent breakdown from server amounts', async () => {
    mocked.mockResolvedValue({
      estimate: {
        currency: 'EUR',
        estimatedDurationMinutes: 180,
        estimatedHours: 3,
        baseHourlyRate: { amountMinor: 1500 },
        subtotal: { amountMinor: 4500 },
        platformFee: { amountMinor: 450 },
        total: { amountMinor: 4950 },
      },
    });
    render(<CostEstimateView taskId="task_1" />);

    expect((await screen.findAllByText('€49.50')).length).toBe(2);
    expect(screen.getByText('€15.00')).toBeInTheDocument();
    expect(screen.getByText('€45.00')).toBeInTheDocument();
    expect(screen.getByText('€4.50')).toBeInTheDocument();
    expect(screen.getByText('3 hours')).toBeInTheDocument();
    expect(
      screen.getByText('This is an estimate based on the task duration and current platform pricing.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/final charge/i)).not.toBeInTheDocument();
  });

  it('shows a duration error from the server', async () => {
    mocked.mockRejectedValue(
      new ApiError(400, {
        code: 'INVALID_DURATION',
        message: 'Add a valid estimated duration before calculating cost.',
        details: [],
      }),
    );
    render(<CostEstimateView taskId="task_1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Add a valid estimated duration before calculating cost.',
    );
  });
});
