import { ApiError, userFacingAuthMessage } from '../../services/api/client';

export function studentAcceptErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'STUDENT_NOT_AVAILABLE') {
      return 'This booking no longer fits your availability.';
    }
    if (
      error.code === 'BOOKING_NOT_PENDING' ||
      error.code === 'BOOKING_ALREADY_ACCEPTED' ||
      error.code === 'BOOKING_REJECTED' ||
      error.code === 'BOOKING_CANCELLED'
    ) {
      return 'This booking request is no longer available for acceptance.';
    }
  }
  return userFacingAuthMessage(error);
}
