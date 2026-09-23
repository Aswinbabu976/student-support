import { apiRequest } from '../../../services/api/client';
import type { RecommendationsResponse } from '../types';

export function listRecommendations(taskId: string): Promise<RecommendationsResponse> {
  return apiRequest<RecommendationsResponse>(`/tasks/${taskId}/recommendations`);
}
