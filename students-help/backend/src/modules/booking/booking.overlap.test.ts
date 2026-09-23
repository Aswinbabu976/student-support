import { describe, expect, it } from 'vitest';
import { bookingInterval, intervalsOverlap } from './booking.overlap.js';

describe('booking interval overlap', () => {
  it('treats intervals as end-exclusive, so back-to-back bookings do not conflict', () => {
    const morning = bookingInterval(new Date('2028-09-20T08:00:00.000Z'), 180);
    const afternoon = bookingInterval(new Date('2028-09-20T11:00:00.000Z'), 60);
    expect(morning.end.toISOString()).toBe('2028-09-20T11:00:00.000Z');
    expect(intervalsOverlap(morning, afternoon)).toBe(false);
  });

  it('detects overlapping intervals', () => {
    const first = bookingInterval(new Date('2028-09-20T08:00:00.000Z'), 180);
    const second = bookingInterval(new Date('2028-09-20T09:00:00.000Z'), 180);
    expect(intervalsOverlap(first, second)).toBe(true);
  });
});
