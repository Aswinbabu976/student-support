import { z } from 'zod';
import { validationError } from '../../shared/errors.js';
import { REJECTION_REASON_MAX_LENGTH, REJECTION_REASON_MIN_LENGTH } from './booking.reason.js';

const createBookingSchema = z
  .object({
    studentId: z.string({ error: 'Student is required.' }),
  })
  .strict();

export function parseTaskId(taskId: string | undefined): string {
  const value = taskId?.trim() ?? '';
  if (!value) {
    throw validationError('The submitted data is invalid.', [
      { field: 'taskId', message: 'Task id is required.' },
    ]);
  }
  return value;
}

export function parseBookingId(bookingId: string | undefined): string {
  const value = bookingId?.trim() ?? '';
  if (!value) {
    throw validationError('The submitted data is invalid.', [
      { field: 'bookingId', message: 'Booking id is required.' },
    ]);
  }
  return value;
}

export function parseAcceptBooking(body: unknown): void {
  z.object({}).strict().parse(body ?? {});
}

export function parseStartBooking(body: unknown): void {
  z.object({}).strict().parse(body ?? {});
}

export function parseMarkDone(body: unknown): void {
  z.object({}).strict().parse(body ?? {});
}

export function parseConfirmCompletion(body: unknown): void {
  z.object({}).strict().parse(body ?? {});
}

export function parseRejectBooking(body: unknown): { reason: string } {
  const parsed = z
    .object({
      reason: z.string({ error: 'A short reason is required.' }),
    })
    .strict()
    .parse(body ?? {});
  const reason = parsed.reason.trim();
  if (!reason) {
    throw validationError('The submitted data is invalid.', [
      { field: 'reason', message: 'A short reason is required.' },
    ]);
  }
  if (reason.length < REJECTION_REASON_MIN_LENGTH) {
    throw validationError('The submitted data is invalid.', [
      {
        field: 'reason',
        message: `Reason must be at least ${REJECTION_REASON_MIN_LENGTH} characters.`,
      },
    ]);
  }
  if (reason.length > REJECTION_REASON_MAX_LENGTH) {
    throw validationError('The submitted data is invalid.', [
      {
        field: 'reason',
        message: `Reason must be ${REJECTION_REASON_MAX_LENGTH} characters or fewer.`,
      },
    ]);
  }
  return { reason };
}

export function parseCreateBooking(body: unknown): { studentId: string } {
  const parsed = createBookingSchema.parse(body);
  const studentId = parsed.studentId.trim();
  if (!studentId) {
    throw validationError('The submitted data is invalid.', [
      { field: 'studentId', message: 'Student is required.' },
    ]);
  }
  return { studentId };
}
