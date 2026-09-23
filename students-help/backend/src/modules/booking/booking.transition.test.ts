import { BookingStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { ErrorCode } from '../../shared/errors.js';
import {
  canConfirmBooking,
  canConfirmCompletion,
  canStartBooking,
  canSubmitCompletion,
  canTransition,
  errorForNonCompletable,
  errorForNonConfirmable,
  errorForNonStartable,
} from './booking.transition.js';

describe('booking FSM start transition', () => {
  it('allows only CONFIRMED → IN_PROGRESS', () => {
    expect(canTransition(BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS)).toBe(true);
    expect(canStartBooking(BookingStatus.CONFIRMED)).toBe(true);
    expect(canConfirmBooking(BookingStatus.ACCEPTED)).toBe(true);
  });

  it('rejects start from every other booking status', () => {
    const blocked: BookingStatus[] = [
      BookingStatus.PENDING,
      BookingStatus.ACCEPTED,
      BookingStatus.REJECTED,
      BookingStatus.CANCELLED,
      BookingStatus.IN_PROGRESS,
      BookingStatus.AWAITING_SIGNOFF,
      BookingStatus.COMPLETED,
    ];
    for (const status of blocked) {
      expect(canStartBooking(status)).toBe(false);
      expect(canTransition(status, BookingStatus.IN_PROGRESS)).toBe(false);
    }
  });

  it('allows Help Seeker confirmation only from AWAITING_SIGNOFF', () => {
    expect(canTransition(BookingStatus.IN_PROGRESS, BookingStatus.AWAITING_SIGNOFF)).toBe(true);
    expect(canTransition(BookingStatus.AWAITING_SIGNOFF, BookingStatus.COMPLETED)).toBe(true);
    expect(canConfirmCompletion(BookingStatus.AWAITING_SIGNOFF)).toBe(true);
    expect(canTransition(BookingStatus.IN_PROGRESS, BookingStatus.COMPLETED)).toBe(false);
  });

  it('maps non-startable statuses to semantic errors', () => {
    expect(errorForNonStartable(BookingStatus.PENDING).code).toBe(ErrorCode.BOOKING_NOT_CONFIRMED);
    expect(errorForNonStartable(BookingStatus.ACCEPTED).code).toBe(ErrorCode.BOOKING_NOT_CONFIRMED);
    expect(errorForNonStartable(BookingStatus.IN_PROGRESS).code).toBe(ErrorCode.TASK_ALREADY_STARTED);
    expect(errorForNonStartable(BookingStatus.CANCELLED).code).toBe(ErrorCode.TASK_CANCELLED);
    expect(errorForNonStartable(BookingStatus.COMPLETED).code).toBe(ErrorCode.INVALID_STATE_TRANSITION);
  });

  it('allows only IN_PROGRESS → AWAITING_SIGNOFF for completion submission', () => {
    expect(canSubmitCompletion(BookingStatus.IN_PROGRESS)).toBe(true);
    const blocked: BookingStatus[] = [
      BookingStatus.PENDING,
      BookingStatus.ACCEPTED,
      BookingStatus.CONFIRMED,
      BookingStatus.REJECTED,
      BookingStatus.CANCELLED,
      BookingStatus.AWAITING_SIGNOFF,
      BookingStatus.COMPLETED,
    ];
    for (const status of blocked) {
      expect(canSubmitCompletion(status)).toBe(false);
      expect(canTransition(status, BookingStatus.AWAITING_SIGNOFF)).toBe(false);
    }
    expect(errorForNonCompletable(BookingStatus.CONFIRMED).code).toBe(ErrorCode.TASK_NOT_IN_PROGRESS);
    expect(errorForNonCompletable(BookingStatus.AWAITING_SIGNOFF).code).toBe(
      ErrorCode.TASK_ALREADY_SUBMITTED,
    );
    expect(errorForNonCompletable(BookingStatus.COMPLETED).code).toBe(ErrorCode.INVALID_STATE_TRANSITION);
  });

  it('rejects confirmation from every status except AWAITING_SIGNOFF', () => {
    const blocked: BookingStatus[] = [
      BookingStatus.PENDING,
      BookingStatus.ACCEPTED,
      BookingStatus.CONFIRMED,
      BookingStatus.IN_PROGRESS,
      BookingStatus.REJECTED,
      BookingStatus.CANCELLED,
      BookingStatus.COMPLETED,
    ];
    for (const status of blocked) {
      expect(canConfirmCompletion(status)).toBe(false);
      expect(canTransition(status, BookingStatus.COMPLETED)).toBe(false);
    }
    expect(errorForNonConfirmable(BookingStatus.IN_PROGRESS).code).toBe(
      ErrorCode.TASK_NOT_AWAITING_SIGNOFF,
    );
    expect(errorForNonConfirmable(BookingStatus.COMPLETED).code).toBe(ErrorCode.TASK_ALREADY_COMPLETED);
    expect(errorForNonConfirmable(BookingStatus.CANCELLED).code).toBe(ErrorCode.TASK_CANCELLED);
    expect(errorForNonConfirmable(BookingStatus.REJECTED).code).toBe(ErrorCode.BOOKING_REJECTED);
  });
});
