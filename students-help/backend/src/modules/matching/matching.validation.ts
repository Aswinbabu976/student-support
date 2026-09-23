import { validationError } from '../../shared/errors.js';

export function parseTaskId(taskId: string | undefined): string {
  const value = taskId?.trim() ?? '';
  if (!value) {
    throw validationError('The submitted data is invalid.', [
      { field: 'taskId', message: 'Task id is required.' },
    ]);
  }
  return value;
}
