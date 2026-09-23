import { ApiError, userFacingAuthMessage } from '../../services/api/client';

export function studentRejectErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'VALIDATION_ERROR') {
      return error.fieldMessage('reason') ?? 'A short reason is required.';
    }
    if (
      error.code === 'BOOKING_NOT_PENDING' ||
      error.code === 'BOOKING_ALREADY_ACCEPTED' ||
      error.code === 'BOOKING_REJECTED' ||
      error.code === 'BOOKING_CANCELLED'
    ) {
      return 'This booking request is no longer available.';
    }
  }
  return userFacingAuthMessage(error);
}
