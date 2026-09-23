import { ApiError, userFacingAuthMessage } from '../../services/api/client';

export function helpSeekerConfirmErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'TASK_NOT_AWAITING_SIGNOFF') {
      return 'This task is not waiting for confirmation.';
    }
    if (error.code === 'TASK_ALREADY_COMPLETED') {
      return 'This task has already been completed.';
    }
    if (error.code === 'TASK_NOT_SUBMITTED') {
      return 'The Student has not submitted this task for confirmation yet.';
    }
    if (error.code === 'PAYMENT_NOT_AUTHORIZED') {
      return 'This booking cannot be confirmed until payment authorization is complete.';
    }
    if (error.code === 'FORBIDDEN' || error.code === 'TASK_CANCELLED') {
      return 'You cannot confirm this task.';
    }
  }
  return userFacingAuthMessage(error);
}
