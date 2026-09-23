import { ApiError, userFacingAuthMessage } from '../../services/api/client';

export function studentDoneErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'TASK_NOT_IN_PROGRESS') {
      return 'This task is not currently in progress.';
    }
    if (error.code === 'TASK_ALREADY_SUBMITTED') {
      return 'This task has already been submitted for confirmation.';
    }
    if (error.code === 'TASK_NOT_STARTED') {
      return 'This task has not been started.';
    }
    if (error.code === 'FORBIDDEN' || error.code === 'TASK_CANCELLED') {
      return 'You cannot complete this task.';
    }
  }
  return userFacingAuthMessage(error);
}
