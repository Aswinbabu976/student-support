/**
 * Booking intervals are end-exclusive.
 * Existing 10:00–12:00 and new 12:00–14:00 do not overlap.
 * Existing 10:00–12:00 and new 11:00–13:00 overlap.
 */
export type TimeInterval = {
  start: Date;
  end: Date;
};

export function bookingInterval(start: Date, durationMinutes: number): TimeInterval {
  return {
    start,
    end: new Date(start.getTime() + durationMinutes * 60 * 1000),
  };
}

export function intervalsOverlap(left: TimeInterval, right: TimeInterval): boolean {
  return left.start.getTime() < right.end.getTime() && left.end.getTime() > right.start.getTime();
}
