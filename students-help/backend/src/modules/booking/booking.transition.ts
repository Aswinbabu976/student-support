import { BookingStatus } from '@prisma/client';
import {
  bookingAlreadyAccepted,
  bookingCancelled,
  bookingNotConfirmed,
  bookingNotPending,
  bookingRejected,
  invalidStateTransition,
  taskAlreadyCompleted,
  taskAlreadyStarted,
  taskAlreadySubmitted,
  taskCancelled,
  taskNotAwaitingSignoff,
  taskNotInProgress,
} from '../../shared/errors.js';

const ALLOWED_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  [BookingStatus.PENDING]: [BookingStatus.ACCEPTED, BookingStatus.REJECTED],
  [BookingStatus.ACCEPTED]: [BookingStatus.CONFIRMED],
  [BookingStatus.CONFIRMED]: [BookingStatus.IN_PROGRESS],
  [BookingStatus.IN_PROGRESS]: [BookingStatus.AWAITING_SIGNOFF],
  [BookingStatus.AWAITING_SIGNOFF]: [BookingStatus.COMPLETED],
  [BookingStatus.COMPLETED]: [],
  [BookingStatus.REJECTED]: [],
  [BookingStatus.CANCELLED]: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function canAcceptBooking(status: BookingStatus): boolean {
  return canTransition(status, BookingStatus.ACCEPTED);
}

export function canRejectBooking(status: BookingStatus): boolean {
  return canTransition(status, BookingStatus.REJECTED);
}

export function canConfirmBooking(status: BookingStatus): boolean {
  return canTransition(status, BookingStatus.CONFIRMED);
}

export function canStartBooking(status: BookingStatus): boolean {
  return canTransition(status, BookingStatus.IN_PROGRESS);
}

export function canSubmitCompletion(status: BookingStatus): boolean {
  return canTransition(status, BookingStatus.AWAITING_SIGNOFF);
}

export function canConfirmCompletion(status: BookingStatus): boolean {
  return canTransition(status, BookingStatus.COMPLETED);
}

export function errorForNonPendingAccept(status: BookingStatus) {
  switch (status) {
    case BookingStatus.ACCEPTED:
      return bookingAlreadyAccepted();
    case BookingStatus.REJECTED:
      return bookingRejected();
    case BookingStatus.CANCELLED:
      return bookingCancelled();
    default:
      return bookingNotPending();
  }
}

export function errorForNonCompletable(status: BookingStatus) {
  switch (status) {
    case BookingStatus.AWAITING_SIGNOFF:
      return taskAlreadySubmitted();
    case BookingStatus.CANCELLED:
      return taskCancelled();
    case BookingStatus.PENDING:
    case BookingStatus.ACCEPTED:
    case BookingStatus.CONFIRMED:
      return taskNotInProgress();
    case BookingStatus.REJECTED:
      return bookingRejected();
    default:
      return invalidStateTransition();
  }
}

export function errorForNonStartable(status: BookingStatus) {
  switch (status) {
    case BookingStatus.IN_PROGRESS:
    case BookingStatus.AWAITING_SIGNOFF:
      return taskAlreadyStarted();
    case BookingStatus.CANCELLED:
      return taskCancelled();
    case BookingStatus.PENDING:
    case BookingStatus.ACCEPTED:
      return bookingNotConfirmed();
    case BookingStatus.REJECTED:
      return bookingRejected();
    default:
      return invalidStateTransition();
  }
}

export function errorForNonConfirmable(status: BookingStatus) {
  switch (status) {
    case BookingStatus.COMPLETED:
      return taskAlreadyCompleted();
    case BookingStatus.CANCELLED:
      return taskCancelled();
    case BookingStatus.REJECTED:
      return bookingRejected();
    default:
      return taskNotAwaitingSignoff();
  }
}
