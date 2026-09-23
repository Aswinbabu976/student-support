import { DayOfWeek } from '@prisma/client';
import { z } from 'zod';
import {
  availabilitySlotOverlap,
  invalidDateRange,
  invalidTimeRange,
  validationError,
} from '../../shared/errors.js';
import { DAYS_OF_WEEK } from './availability.time.js';
import {
  compareIsoDates,
  findOverlappingSlotPair,
  isValidClockTime,
  isValidTimeZone,
  parseClockTimeToMinutes,
  parseIsoDate,
} from './availability.time.js';
import type {
  ReplaceWeeklyAvailabilityInput,
  UnavailablePeriodInput,
  WeeklyDayInput,
} from './availability.types.js';

const dayOfWeekSchema = z.enum(DAYS_OF_WEEK);

const weeklySlotSchema = z
  .object({
    start: z.string().trim().min(1, 'Start time is required.'),
    end: z.string().trim().min(1, 'End time is required.'),
  })
  .strict();

const weeklyDaySchema = z
  .object({
    dayOfWeek: dayOfWeekSchema,
    slots: z.array(weeklySlotSchema).max(12, 'A day can have at most 12 time slots.'),
  })
  .strict();

export const replaceWeeklyAvailabilitySchema = z
  .object({
    timezone: z.string().trim().min(1, 'Timezone is required.'),
    days: z.array(weeklyDaySchema).max(7),
  })
  .strict();

export const unavailablePeriodSchema = z
  .object({
    startDate: z.string().trim().min(1, 'Start date is required.'),
    endDate: z.string().trim().min(1, 'End date is required.'),
    reason: z.union([z.string(), z.null()]).optional(),
  })
  .strict();

export const updateUnavailablePeriodSchema = z
  .object({
    startDate: z.string().trim().min(1, 'Start date is required.').optional(),
    endDate: z.string().trim().min(1, 'End date is required.').optional(),
    reason: z.union([z.string(), z.null()]).optional(),
  })
  .strict();

function normalizeClockTime(value: string, field: string): string {
  const trimmed = value.trim();
  const withSeconds = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/.exec(trimmed);
  const clock = withSeconds ? `${withSeconds[1]}:${withSeconds[2]}` : trimmed;
  if (!isValidClockTime(clock)) {
    throw validationError('The submitted data is invalid.', [
      { field, message: 'Enter a valid time as HH:mm.' },
    ]);
  }
  return clock;
}

function normalizeReason(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length > 200) {
    throw validationError('The submitted data is invalid.', [
      { field: 'reason', message: 'Reason must be 200 characters or fewer.' },
    ]);
  }
  return trimmed.length > 0 ? trimmed : null;
}

function validateDaySlots(day: WeeklyDayInput): WeeklyDayInput {
  const slots = day.slots.map((slot, index) => {
    const start = normalizeClockTime(slot.start, `days.${day.dayOfWeek}.slots.${index}.start`);
    const end = normalizeClockTime(slot.end, `days.${day.dayOfWeek}.slots.${index}.end`);
    const startMinutes = parseClockTimeToMinutes(start);
    const endMinutes = parseClockTimeToMinutes(end);
    if (startMinutes >= endMinutes) {
      throw invalidTimeRange('End time must be later than start time.');
    }
    return { start, end };
  });

  const overlap = findOverlappingSlotPair(
    slots.map((slot) => ({
      start: parseClockTimeToMinutes(slot.start),
      end: parseClockTimeToMinutes(slot.end),
    })),
  );
  if (overlap) {
    throw availabilitySlotOverlap();
  }

  return { dayOfWeek: day.dayOfWeek, slots };
}

export function parseReplaceWeeklyAvailability(body: unknown): ReplaceWeeklyAvailabilityInput {
  const parsed = replaceWeeklyAvailabilitySchema.parse(body);
  if (!isValidTimeZone(parsed.timezone)) {
    throw validationError('The submitted data is invalid.', [
      { field: 'timezone', message: 'Choose a valid IANA timezone.' },
    ]);
  }

  const seen = new Set<DayOfWeek>();
  const days: WeeklyDayInput[] = [];
  for (const day of parsed.days) {
    if (seen.has(day.dayOfWeek)) {
      throw validationError('The submitted data is invalid.', [
        { field: 'days', message: 'Each weekday can appear only once.' },
      ]);
    }
    seen.add(day.dayOfWeek);
    days.push(validateDaySlots(day));
  }

  return {
    timezone: parsed.timezone,
    days,
  };
}

function parseCalendarDate(value: string, field: string): string {
  const parsed = parseIsoDate(value);
  if (!parsed) {
    throw validationError('The submitted data is invalid.', [
      { field, message: 'Enter a valid date as YYYY-MM-DD.' },
    ]);
  }
  return `${String(parsed.year).padStart(4, '0')}-${String(parsed.month).padStart(2, '0')}-${String(parsed.day).padStart(2, '0')}`;
}

export function parseUnavailablePeriod(body: unknown): UnavailablePeriodInput {
  const parsed = unavailablePeriodSchema.parse(body);
  return normalizeUnavailablePeriod({
    startDate: parsed.startDate,
    endDate: parsed.endDate,
    reason: parsed.reason,
  });
}

export function parseUpdateUnavailablePeriod(
  body: unknown,
  current: { startDate: string; endDate: string; reason: string | null },
): UnavailablePeriodInput {
  const parsed = updateUnavailablePeriodSchema.parse(body);
  if (
    parsed.startDate === undefined &&
    parsed.endDate === undefined &&
    parsed.reason === undefined
  ) {
    throw validationError('The submitted data is invalid.', [
      { message: 'Provide at least one field to update.' },
    ]);
  }
  return normalizeUnavailablePeriod({
    startDate: parsed.startDate ?? current.startDate,
    endDate: parsed.endDate ?? current.endDate,
    reason: parsed.reason === undefined ? current.reason : parsed.reason,
  });
}

function normalizeUnavailablePeriod(input: {
  startDate: string;
  endDate: string;
  reason: string | null | undefined;
}): UnavailablePeriodInput {
  const startDate = parseCalendarDate(input.startDate, 'startDate');
  const endDate = parseCalendarDate(input.endDate, 'endDate');
  if (compareIsoDates(endDate, startDate) < 0) {
    throw invalidDateRange('End date must be on or after the start date.');
  }

  return {
    startDate,
    endDate,
    reason: normalizeReason(input.reason) ?? null,
  };
}
