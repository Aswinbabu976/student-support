import { apiRequest } from '../../../services/api/client';
import type { CostEstimateResponse } from '../types';

export function getCostEstimate(taskId: string): Promise<CostEstimateResponse> {
  return apiRequest<CostEstimateResponse>(`/tasks/${taskId}/cost-estimate`);
}
