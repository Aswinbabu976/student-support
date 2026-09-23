import { ApiError, userFacingAuthMessage } from '../../services/api/client';

export function studentStartErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'BOOKING_NOT_CONFIRMED') {
      return 'This booking is not ready to start yet.';
    }
    if (error.code === 'PAYMENT_NOT_AUTHORIZED') {
      return 'This task cannot be started until payment authorization is complete.';
    }
    if (error.code === 'TASK_ALREADY_STARTED') {
      return 'This task has already been started.';
    }
    if (error.code === 'FORBIDDEN' || error.code === 'TASK_CANCELLED') {
      return 'You cannot start this task.';
    }
  }
  return userFacingAuthMessage(error);
}
