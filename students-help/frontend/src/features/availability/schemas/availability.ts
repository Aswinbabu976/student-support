import { z } from 'zod';
import { DAYS_OF_WEEK, type DayOfWeek, type TimeSlot } from '../types';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type WeeklyFieldErrors = {
  timezone?: string;
  form?: string;
  days?: Partial<Record<DayOfWeek, string>>;
  slots?: Record<string, string>;
};

function clockToMinutes(value: string): number {
  const [hours, minutes] = value.split(':');
  return Number(hours) * 60 + Number(minutes);
}

function normalizeClock(value: string): string {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(value.trim());
  return match ? `${match[1]}:${match[2]}` : value.trim();
}

export function validateWeeklySchedule(
  timezone: string,
  days: Record<DayOfWeek, { enabled: boolean; slots: TimeSlot[] }>,
): WeeklyFieldErrors {
  const errors: WeeklyFieldErrors = { days: {}, slots: {} };
  if (!timezone.trim()) {
    errors.timezone = 'Choose a timezone.';
  }

  for (const day of DAYS_OF_WEEK) {
    const state = days[day];
    if (!state?.enabled) {
      continue;
    }
    if (state.slots.length === 0) {
      errors.days![day] = 'Add at least one time slot, or mark the day as not available.';
      continue;
    }
    const parsed: Array<{ start: number; end: number }> = [];
    state.slots.forEach((slot, index) => {
      const start = normalizeClock(slot.start);
      const end = normalizeClock(slot.end);
      const startKey = `${day}-${index}-start`;
      const endKey = `${day}-${index}-end`;
      if (!TIME_PATTERN.test(start)) {
        errors.slots![startKey] = 'Start time is required.';
      }
      if (!TIME_PATTERN.test(end)) {
        errors.slots![endKey] = 'End time is required.';
      }
      if (TIME_PATTERN.test(start) && TIME_PATTERN.test(end) && clockToMinutes(start) >= clockToMinutes(end)) {
        errors.slots![endKey] = 'End time must be later than start time.';
      }
      if (TIME_PATTERN.test(start) && TIME_PATTERN.test(end)) {
        parsed.push({ start: clockToMinutes(start), end: clockToMinutes(end) });
      }
    });
    const ordered = parsed
      .map((slot, index) => ({ ...slot, index }))
      .sort((a, b) => a.start - b.start || a.end - b.end);
    for (let i = 0; i < ordered.length - 1; i += 1) {
      const current = ordered[i];
      const next = ordered[i + 1];
      if (current && next && current.start < next.end && next.start < current.end) {
        errors.days![day] = 'This time overlaps with another availability slot.';
        break;
      }
    }
  }

  if (!errors.timezone && Object.keys(errors.days ?? {}).length === 0 && Object.keys(errors.slots ?? {}).length === 0) {
    return {};
  }
  return errors;
}

export const unavailablePeriodSchema = z
  .object({
    startDate: z
      .string()
      .trim()
      .min(1, 'Start date is required.')
      .regex(DATE_PATTERN, 'Enter a valid start date.'),
    endDate: z
      .string()
      .trim()
      .min(1, 'End date is required.')
      .regex(DATE_PATTERN, 'Enter a valid end date.'),
    reason: z.string().trim().max(200, 'Reason must be 200 characters or fewer.'),
  })
  .superRefine((value, ctx) => {
    if (value.endDate && value.startDate && value.endDate < value.startDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'End date must be on or after the start date.',
      });
    }
  });

export type UnavailablePeriodValues = z.infer<typeof unavailablePeriodSchema>;
