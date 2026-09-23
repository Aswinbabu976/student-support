import { DayOfWeek } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  findOverlappingSlotPair,
  isIntervalCoveredByWeeklySlots,
  parseClockTimeToMinutes,
  slotsOverlap,
  unavailableRangeFromDates,
  utcToZonedParts,
  zonedLocalToUtc,
} from './availability.time.js';

describe('availability time helpers', () => {
  it('detects overlapping slots and allows adjacent slots', () => {
    expect(
      slotsOverlap(
        { start: parseClockTimeToMinutes('10:00'), end: parseClockTimeToMinutes('14:00') },
        { start: parseClockTimeToMinutes('13:00'), end: parseClockTimeToMinutes('16:00') },
      ),
    ).toBe(true);
    expect(
      slotsOverlap(
        { start: parseClockTimeToMinutes('10:00'), end: parseClockTimeToMinutes('12:00') },
        { start: parseClockTimeToMinutes('12:00'), end: parseClockTimeToMinutes('14:00') },
      ),
    ).toBe(false);
    expect(
      findOverlappingSlotPair([
        { start: 600, end: 840 },
        { start: 780, end: 960 },
      ]),
    ).toEqual([0, 1]);
  });

  it('converts Stockholm local midnight to UTC', () => {
    const instant = zonedLocalToUtc('Europe/Stockholm', 2026, 9, 20, 0, 0);
    expect(instant.toISOString()).toBe('2026-09-19T22:00:00.000Z');
    const parts = utcToZonedParts(instant, 'Europe/Stockholm');
    expect(parts.date).toBe('2026-09-20');
    expect(parts.hour).toBe(0);
    expect(parts.dayOfWeek).toBe(DayOfWeek.SUNDAY);
  });

  it('covers a task inside a recurring slot and rejects hours outside it', () => {
    const timezone = 'Europe/Stockholm';
    const slots = [
      { dayOfWeek: DayOfWeek.MONDAY, startTime: '16:00', endTime: '20:00', isActive: true },
    ];
    const insideStart = zonedLocalToUtc(timezone, 2026, 9, 21, 16, 0);
    const insideEnd = zonedLocalToUtc(timezone, 2026, 9, 21, 18, 0);
    const outsideEnd = zonedLocalToUtc(timezone, 2026, 9, 21, 21, 0);

    expect(isIntervalCoveredByWeeklySlots(timezone, insideStart, insideEnd, slots)).toBe(true);
    expect(isIntervalCoveredByWeeklySlots(timezone, insideStart, outsideEnd, slots)).toBe(false);
  });

  it('builds an exclusive UTC range for an inclusive vacation in the student timezone', () => {
    const range = unavailableRangeFromDates('Europe/Stockholm', '2026-09-20', '2026-09-27');
    expect(range.startDateTime.toISOString()).toBe('2026-09-19T22:00:00.000Z');
    expect(range.endDateTime.toISOString()).toBe('2026-09-27T22:00:00.000Z');
  });
});
