import { apiRequest } from '../../../services/api/client';
import type {
  AvailabilityResponse,
  ReplaceWeeklyInput,
  UnavailablePeriodInput,
  UnavailablePeriodView,
} from '../types';

export function getAvailability(): Promise<AvailabilityResponse> {
  return apiRequest<AvailabilityResponse>('/students/me/availability');
}

export function saveWeeklyAvailability(input: ReplaceWeeklyInput): Promise<AvailabilityResponse> {
  return apiRequest<AvailabilityResponse>('/students/me/availability/weekly', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function createUnavailablePeriod(
  input: UnavailablePeriodInput,
): Promise<{ period: UnavailablePeriodView }> {
  return apiRequest<{ period: UnavailablePeriodView }>('/students/me/availability/unavailable', {
    method: 'POST',
    body: JSON.stringify({
      startDate: input.startDate,
      endDate: input.endDate,
      reason: input.reason,
    }),
  });
}

export function deleteUnavailablePeriod(periodId: string): Promise<void> {
  return apiRequest<void>(`/students/me/availability/unavailable/${periodId}`, {
    method: 'DELETE',
  });
}
