import { z } from 'zod';
import { clockTimeFromInput, isFuturePreferredStart, parseDurationMinutes } from '../format';
import type { CreateTaskPayload, TaskFormValues } from '../types';

export const TITLE_MIN = 3;
export const TITLE_MAX = 80;
export const DESCRIPTION_MIN = 20;
export const DESCRIPTION_MAX = 2000;
export const LOCATION_MIN = 8;
export const LOCATION_MAX = 200;
export const INSTRUCTIONS_MAX = 500;
export const DURATION_MIN = 1;
export const DURATION_MAX = 1440;

export type TaskFormErrors = {
  title?: string;
  description?: string;
  skillIds?: string;
  locationLine?: string;
  timezone?: string;
  preferredDate?: string;
  preferredTime?: string;
  estimatedDurationMinutes?: string;
  specialInstructions?: string;
};

export const emptyTaskForm = (timezone: string): TaskFormValues => ({
  title: '',
  description: '',
  skillIds: [],
  locationLine: '',
  useSavedAddress: false,
  timezone,
  preferredDate: '',
  preferredTime: '',
  durationHours: '',
  durationMinutes: '',
  specialInstructions: '',
});

export const taskFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Title is required.')
      .min(TITLE_MIN, `Title must be at least ${TITLE_MIN} characters.`)
      .max(TITLE_MAX, `Title must be ${TITLE_MAX} characters or fewer.`),
    description: z
      .string()
      .trim()
      .min(1, 'Description is required.')
      .min(DESCRIPTION_MIN, `Description must be at least ${DESCRIPTION_MIN} characters.`)
      .max(DESCRIPTION_MAX, `Description must be ${DESCRIPTION_MAX} characters or fewer.`),
    skillIds: z.array(z.string()).min(1, 'Select at least one required skill.'),
    locationLine: z
      .string()
      .trim()
      .min(1, 'Enter a location for this task.')
      .min(LOCATION_MIN, 'Enter a street address with city or postal details.')
      .max(LOCATION_MAX, `Location must be ${LOCATION_MAX} characters or fewer.`),
    timezone: z.string().trim().min(1, 'Choose a valid IANA timezone.'),
    preferredDate: z.string().trim().min(1, 'Date is required.'),
    preferredTime: z.string().trim().min(1, 'Time is required.'),
    durationHours: z.string(),
    durationMinutes: z.string(),
    specialInstructions: z
      .string()
      .trim()
      .max(INSTRUCTIONS_MAX, `Special instructions must be ${INSTRUCTIONS_MAX} characters or fewer.`),
  })
  .superRefine((value, ctx) => {
    const time = clockTimeFromInput(value.preferredTime);
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(time)) {
      ctx.addIssue({
        code: 'custom',
        path: ['preferredTime'],
        message: 'Enter a valid time as HH:mm.',
      });
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(value.preferredDate)) {
      ctx.addIssue({
        code: 'custom',
        path: ['preferredDate'],
        message: 'Enter a valid date.',
      });
    } else if (!isFuturePreferredStart(value.preferredDate, time, value.timezone)) {
      ctx.addIssue({
        code: 'custom',
        path: ['preferredDate'],
        message: 'Choose a future date and time.',
      });
    }

    const duration = parseDurationMinutes(value.durationHours, value.durationMinutes);
    if (duration === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['estimatedDurationMinutes'],
        message: 'Enter a valid estimated duration.',
      });
    } else if (!Number.isInteger(duration) || duration < DURATION_MIN || duration > DURATION_MAX) {
      ctx.addIssue({
        code: 'custom',
        path: ['estimatedDurationMinutes'],
        message: 'Enter a duration between 1 minute and 24 hours.',
      });
    }
  });

export function taskFormToPayload(values: TaskFormValues): CreateTaskPayload | { errors: TaskFormErrors } {
  const parsed = taskFormSchema.safeParse({
    title: values.title,
    description: values.description,
    skillIds: values.skillIds,
    locationLine: values.locationLine,
    timezone: values.timezone,
    preferredDate: values.preferredDate,
    preferredTime: values.preferredTime,
    durationHours: values.durationHours,
    durationMinutes: values.durationMinutes,
    specialInstructions: values.specialInstructions,
  });

  if (!parsed.success) {
    const errors: TaskFormErrors = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === 'string' && !(field in errors)) {
        const key = field === 'durationHours' || field === 'durationMinutes' ? 'estimatedDurationMinutes' : field;
        if (
          key === 'title' ||
          key === 'description' ||
          key === 'skillIds' ||
          key === 'locationLine' ||
          key === 'timezone' ||
          key === 'preferredDate' ||
          key === 'preferredTime' ||
          key === 'estimatedDurationMinutes' ||
          key === 'specialInstructions'
        ) {
          errors[key] = issue.message;
        }
      }
    }
    return { errors };
  }

  const duration = parseDurationMinutes(parsed.data.durationHours, parsed.data.durationMinutes);
  return {
    title: parsed.data.title,
    description: parsed.data.description,
    skillIds: parsed.data.skillIds,
    location: { addressLine: parsed.data.locationLine },
    timezone: parsed.data.timezone,
    preferredDate: parsed.data.preferredDate,
    preferredTime: clockTimeFromInput(parsed.data.preferredTime),
    estimatedDurationMinutes: duration ?? 0,
    specialInstructions: parsed.data.specialInstructions,
  };
}
