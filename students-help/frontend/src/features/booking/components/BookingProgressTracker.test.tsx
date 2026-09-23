import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BookingProgressTracker } from './BookingProgressTracker';
import { buildBookingProgress } from '../progress';

describe('BookingProgressTracker', () => {
  it('identifies the current PENDING step in text, not only color', () => {
    const progress = buildBookingProgress({
      status: 'PENDING',
      createdAt: '2026-09-10T08:42:00.000Z',
      updatedAt: '2026-09-10T08:42:00.000Z',
      rejectedAt: null,
      statusHistory: [{ status: 'PENDING', createdAt: '2026-09-10T08:42:00.000Z' }],
      audience: 'HELP_SEEKER',
    });
    render(<BookingProgressTracker progress={progress} />);

    expect(screen.getByText('Waiting for Student').closest('li')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('Current step')).toBeInTheDocument();
    expect(screen.getByText('Completed.')).toBeInTheDocument();
    expect(screen.getAllByText('Upcoming.').length).toBe(2);
  });

  it('keeps HOLD and CONFIRMED incomplete after ACCEPTED', () => {
    const progress = buildBookingProgress({
      status: 'ACCEPTED',
      createdAt: '2026-09-10T08:42:00.000Z',
      updatedAt: '2026-09-10T09:10:00.000Z',
      rejectedAt: null,
      statusHistory: [
        { status: 'PENDING', createdAt: '2026-09-10T08:42:00.000Z' },
        { status: 'ACCEPTED', createdAt: '2026-09-10T09:10:00.000Z' },
      ],
      audience: 'HELP_SEEKER',
    });
    render(<BookingProgressTracker progress={progress} />);

    expect(screen.getByText('Payment authorization pending').closest('li')).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(screen.getByText('Booking confirmed').closest('li')).not.toHaveAttribute('aria-current');
  });
});
