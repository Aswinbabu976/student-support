import { apiRequest } from '../../../services/api/client';
import type { CreateTaskPayload, CreateTaskResponse, TaskResponse } from '../types';

export function createTask(input: CreateTaskPayload): Promise<CreateTaskResponse> {
  return apiRequest<CreateTaskResponse>('/tasks', {
    method: 'POST',
    body: JSON.stringify({
      title: input.title,
      description: input.description,
      skillIds: input.skillIds,
      location: input.location,
      timezone: input.timezone,
      preferredDate: input.preferredDate,
      preferredTime: input.preferredTime,
      estimatedDurationMinutes: input.estimatedDurationMinutes,
      specialInstructions: input.specialInstructions,
    }),
  });
}

export function getTask(taskId: string): Promise<TaskResponse> {
  return apiRequest<TaskResponse>(`/tasks/${taskId}`);
}
