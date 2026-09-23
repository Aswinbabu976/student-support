import { z } from 'zod';
import {
  invalidDuration,
  invalidLocation,
  invalidTaskDate,
  skillNotFound,
  taskSkillRequired,
  validationError,
} from '../../shared/errors.js';
import {
  isValidClockTime,
  isValidTimeZone,
  parseIsoDate,
  zonedLocalToUtc,
} from '../availability/availability.time.js';
import type { CreateTaskInput } from './tasks.types.js';

const TITLE_MIN = 3;
const TITLE_MAX = 80;
const DESCRIPTION_MIN = 20;
const DESCRIPTION_MAX = 2000;
const LOCATION_MIN = 8;
const LOCATION_MAX = 200;
const INSTRUCTIONS_MAX = 500;
const DURATION_MIN = 1;
const DURATION_MAX = 1440;
const MAX_SKILLS = 10;

export const createTaskSchema = z
  .object({
    title: z.string({ error: 'Title is required.' }),
    description: z.string({ error: 'Description is required.' }),
    skillIds: z.array(z.string()).optional(),
    location: z
      .object({
        addressLine: z.string({ error: 'Enter a location for this task.' }),
      })
      .strict()
      .optional(),
    timezone: z.string({ error: 'Timezone is required.' }),
    preferredDate: z.string({ error: 'Date is required.' }),
    preferredTime: z.string({ error: 'Time is required.' }),
    estimatedDurationMinutes: z.number({ error: 'Enter a valid estimated duration.' }).optional(),
    specialInstructions: z.union([z.string(), z.null()]).optional(),
    photoIds: z.array(z.string()).optional(),
  })
  .strict();

function requiredText(value: string | undefined, field: string, emptyMessage: string): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) {
    throw validationError('The submitted data is invalid.', [{ field, message: emptyMessage }]);
  }
  return trimmed;
}

export function parseCreateTask(body: unknown, now = new Date()): CreateTaskInput {
  const parsed = createTaskSchema.parse(body);

  const title = requiredText(parsed.title, 'title', 'Title is required.');
  if (title.length < TITLE_MIN) {
    throw validationError('The submitted data is invalid.', [
      { field: 'title', message: `Title must be at least ${TITLE_MIN} characters.` },
    ]);
  }
  if (title.length > TITLE_MAX) {
    throw validationError('The submitted data is invalid.', [
      { field: 'title', message: `Title must be ${TITLE_MAX} characters or fewer.` },
    ]);
  }

  const description = requiredText(parsed.description, 'description', 'Description is required.');
  if (description.length < DESCRIPTION_MIN) {
    throw validationError('The submitted data is invalid.', [
      { field: 'description', message: `Description must be at least ${DESCRIPTION_MIN} characters.` },
    ]);
  }
  if (description.length > DESCRIPTION_MAX) {
    throw validationError('The submitted data is invalid.', [
      { field: 'description', message: `Description must be ${DESCRIPTION_MAX} characters or fewer.` },
    ]);
  }

  const rawSkillIds = parsed.skillIds ?? [];
  if (rawSkillIds.some((id) => !id.trim())) {
    throw validationError('The submitted data is invalid.', [
      { field: 'skillIds', message: 'Select a valid skill.' },
    ]);
  }
  const skillIds = rawSkillIds.map((id) => id.trim());
  if (new Set(skillIds).size !== skillIds.length) {
    throw validationError('The submitted data is invalid.', [
      { field: 'skillIds', message: 'Remove duplicate skills before publishing.' },
    ]);
  }
  if (skillIds.length === 0) {
    throw taskSkillRequired();
  }
  if (skillIds.length > MAX_SKILLS) {
    throw validationError('The submitted data is invalid.', [
      { field: 'skillIds', message: `Select at most ${MAX_SKILLS} skills.` },
    ]);
  }

  const locationLine = parsed.location?.addressLine?.trim() ?? '';
  if (!locationLine) {
    throw invalidLocation();
  }
  if (locationLine.length < LOCATION_MIN) {
    throw invalidLocation('Enter a street address with city or postal details.');
  }
  if (locationLine.length > LOCATION_MAX) {
    throw invalidLocation(`Location must be ${LOCATION_MAX} characters or fewer.`);
  }

  const timezone = parsed.timezone.trim();
  if (!timezone || !isValidTimeZone(timezone)) {
    throw validationError('The submitted data is invalid.', [
      { field: 'timezone', message: 'Choose a valid IANA timezone.' },
    ]);
  }

  const preferredDate = parsed.preferredDate.trim();
  if (!preferredDate) {
    throw validationError('The submitted data is invalid.', [
      { field: 'preferredDate', message: 'Date is required.' },
    ]);
  }
  const dateParts = parseIsoDate(preferredDate);
  if (!dateParts) {
    throw invalidTaskDate('Enter a valid date.');
  }

  let preferredTime = parsed.preferredTime.trim();
  if (!preferredTime) {
    throw validationError('The submitted data is invalid.', [
      { field: 'preferredTime', message: 'Time is required.' },
    ]);
  }
  const withSeconds = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/.exec(preferredTime);
  if (withSeconds) {
    preferredTime = `${withSeconds[1]}:${withSeconds[2]}`;
  }
  if (!isValidClockTime(preferredTime)) {
    throw validationError('The submitted data is invalid.', [
      { field: 'preferredTime', message: 'Enter a valid time as HH:mm.' },
    ]);
  }

  const [hours, minutes] = preferredTime.split(':').map(Number) as [number, number];
  const preferredStartAt = zonedLocalToUtc(
    timezone,
    dateParts.year,
    dateParts.month,
    dateParts.day,
    hours,
    minutes,
  );
  if (preferredStartAt.getTime() <= now.getTime()) {
    throw invalidTaskDate();
  }

  const duration = parsed.estimatedDurationMinutes;
  if (duration === undefined || !Number.isInteger(duration)) {
    throw invalidDuration();
  }
  if (duration < DURATION_MIN || duration > DURATION_MAX) {
    throw invalidDuration('Enter a duration between 1 minute and 24 hours.');
  }

  if ((parsed.photoIds ?? []).length > 0) {
    throw validationError('The submitted data is invalid.', [
      {
        field: 'photoIds',
        message: 'Photo uploads are not available yet. Publish the task without photos.',
      },
    ]);
  }

  let specialInstructions: string | null = null;
  if (parsed.specialInstructions !== undefined && parsed.specialInstructions !== null) {
    const trimmed = parsed.specialInstructions.trim();
    if (trimmed.length > INSTRUCTIONS_MAX) {
      throw validationError('The submitted data is invalid.', [
        {
          field: 'specialInstructions',
          message: `Special instructions must be ${INSTRUCTIONS_MAX} characters or fewer.`,
        },
      ]);
    }
    specialInstructions = trimmed.length > 0 ? trimmed : null;
  }

  return {
    title,
    description,
    skillIds,
    locationLine,
    timezone,
    preferredDate,
    preferredTime,
    preferredStartAt,
    estimatedDurationMinutes: duration,
    specialInstructions,
  };
}

export function assertSkillsExist(
  requestedIds: string[],
  found: Array<{ id: string; isActive: boolean }>,
): void {
  const foundIds = new Set(found.filter((skill) => skill.isActive).map((skill) => skill.id));
  const missing = requestedIds.some((id) => !foundIds.has(id));
  if (missing) {
    throw skillNotFound();
  }
}
