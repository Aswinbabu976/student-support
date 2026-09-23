import { describe, expect, it } from 'vitest';
import { buildBookingProgress } from './progress';

describe('buildBookingProgress', () => {
  it('does not complete HOLD or CONFIRMED for PENDING', () => {
    const progress = buildBookingProgress({
      status: 'PENDING',
      createdAt: '2026-09-10T08:42:00.000Z',
      updatedAt: '2026-09-10T08:42:00.000Z',
      rejectedAt: null,
      statusHistory: [{ status: 'PENDING', createdAt: '2026-09-10T08:42:00.000Z' }],
      audience: 'HELP_SEEKER',
    });
    expect(progress.steps.map((step) => [step.id, step.state])).toEqual([
      ['REQUEST', 'complete'],
      ['ACCEPT', 'current'],
      ['HOLD', 'upcoming'],
      ['CONFIRMED', 'upcoming'],
    ]);
  });
});
