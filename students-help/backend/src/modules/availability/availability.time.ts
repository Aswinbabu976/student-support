import { DayOfWeek } from '@prisma/client';

export const DAYS_OF_WEEK = [
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
  DayOfWeek.SUNDAY,
] as const;

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const WEEKDAY_TO_DAY: Record<string, DayOfWeek> = {
  Monday: DayOfWeek.MONDAY,
  Tuesday: DayOfWeek.TUESDAY,
  Wednesday: DayOfWeek.WEDNESDAY,
  Thursday: DayOfWeek.THURSDAY,
  Friday: DayOfWeek.FRIDAY,
  Saturday: DayOfWeek.SATURDAY,
  Sunday: DayOfWeek.SUNDAY,
};

export type TimeSlotMinutes = {
  start: number;
  end: number;
};

export type ZonedDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  dayOfWeek: DayOfWeek;
  date: string;
};

export function isValidTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function isValidClockTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

export function parseClockTimeToMinutes(value: string): number {
  const match = TIME_PATTERN.exec(value);
  if (!match) {
    throw new Error('Invalid clock time');
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

export function minutesToClockTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function parseIsoDate(value: string): { year: number; month: number; day: number } | null {
  const match = DATE_PATTERN.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = Date.UTC(year, month - 1, day);
  const check = new Date(utc);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

export function formatIsoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function slotsOverlap(left: TimeSlotMinutes, right: TimeSlotMinutes): boolean {
  return left.start < right.end && right.start < left.end;
}

export function findOverlappingSlotPair(slots: TimeSlotMinutes[]): [number, number] | null {
  const ordered = slots
    .map((slot, index) => ({ ...slot, index }))
    .sort((a, b) => a.start - b.start || a.end - b.end);
  for (let i = 0; i < ordered.length - 1; i += 1) {
    const current = ordered[i];
    const next = ordered[i + 1];
    if (current && next && slotsOverlap(current, next)) {
      return [current.index, next.index];
    }
  }
  return null;
}

function formatParts(instant: Date, timeZone: string): ZonedDateTimeParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const values: Record<string, string> = {};
  for (const part of formatter.formatToParts(instant)) {
    if (part.type !== 'literal') {
      values[part.type] = part.value;
    }
  }
  const weekday = values.weekday ?? '';
  const dayOfWeek = WEEKDAY_TO_DAY[weekday];
  if (!dayOfWeek) {
    throw new Error(`Unsupported weekday: ${weekday}`);
  }
  const year = Number(values.year);
  const month = Number(values.month);
  const day = Number(values.day);
  return {
    year,
    month,
    day,
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
    dayOfWeek,
    date: formatIsoDate(year, month, day),
  };
}

export function getTimeZoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = formatParts(instant, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - instant.getTime();
}

export function zonedLocalToUtc(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  const firstOffset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  const firstInstant = new Date(utcGuess - firstOffset);
  const secondOffset = getTimeZoneOffsetMs(firstInstant, timeZone);
  if (firstOffset !== secondOffset) {
    return new Date(utcGuess - secondOffset);
  }
  return firstInstant;
}

export function utcToZonedParts(instant: Date, timeZone: string): ZonedDateTimeParts {
  return formatParts(instant, timeZone);
}

export function addCalendarDays(year: number, month: number, day: number, days: number) {
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

export function compareIsoDates(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

export function zonedCalendarDate(instant: Date, timeZone: string): string {
  return utcToZonedParts(instant, timeZone).date;
}

export function unavailableRangeFromDates(
  timeZone: string,
  startDate: string,
  endDate: string,
): { startDateTime: Date; endDateTime: Date } {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  if (!start || !end) {
    throw new Error('Invalid calendar date');
  }
  const exclusiveEnd = addCalendarDays(end.year, end.month, end.day, 1);
  return {
    startDateTime: zonedLocalToUtc(timeZone, start.year, start.month, start.day),
    endDateTime: zonedLocalToUtc(
      timeZone,
      exclusiveEnd.year,
      exclusiveEnd.month,
      exclusiveEnd.day,
    ),
  };
}

export function inclusiveDatesFromRange(
  timeZone: string,
  startDateTime: Date,
  endDateTime: Date,
): { startDate: string; endDate: string } {
  const start = utcToZonedParts(startDateTime, timeZone);
  const endExclusive = utcToZonedParts(endDateTime, timeZone);
  const inclusiveEnd = addCalendarDays(endExclusive.year, endExclusive.month, endExclusive.day, -1);
  return {
    startDate: start.date,
    endDate: formatIsoDate(inclusiveEnd.year, inclusiveEnd.month, inclusiveEnd.day),
  };
}

export function rangesOverlap(
  leftStart: Date,
  leftEnd: Date,
  rightStart: Date,
  rightEnd: Date,
): boolean {
  return leftStart.getTime() < rightEnd.getTime() && rightStart.getTime() < leftEnd.getTime();
}

type RecurringSlot = {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  isActive?: boolean;
};

function minutesOnDay(parts: ZonedDateTimeParts): number {
  return parts.hour * 60 + parts.minute;
}

export function isIntervalCoveredByWeeklySlots(
  timeZone: string,
  start: Date,
  end: Date,
  slots: RecurringSlot[],
): boolean {
  if (end.getTime() <= start.getTime()) {
    return false;
  }

  const active = slots.filter((slot) => slot.isActive !== false);
  let cursor = new Date(start);

  while (cursor.getTime() < end.getTime()) {
    const local = utcToZonedParts(cursor, timeZone);
    const nextDay = addCalendarDays(local.year, local.month, local.day, 1);
    const nextMidnight = zonedLocalToUtc(timeZone, nextDay.year, nextDay.month, nextDay.day);
    const segmentEndMs = Math.min(end.getTime(), nextMidnight.getTime());
    if (segmentEndMs <= cursor.getTime()) {
      return false;
    }

    const startMinutes = minutesOnDay(local);
    const endMinutes =
      segmentEndMs === nextMidnight.getTime()
        ? 24 * 60
        : minutesOnDay(utcToZonedParts(new Date(segmentEndMs), timeZone));

    const covered = active.some((slot) => {
      if (slot.dayOfWeek !== local.dayOfWeek) {
        return false;
      }
      const slotStart = parseClockTimeToMinutes(slot.startTime);
      const slotEnd = parseClockTimeToMinutes(slot.endTime);
      return slotStart <= startMinutes && slotEnd >= endMinutes;
    });

    if (!covered) {
      return false;
    }

    cursor = new Date(segmentEndMs);
  }

  return true;
}
