import { useEffect, useState } from 'react';
import { ApiError } from '../../../services/api/client';
import { getCostEstimate } from '../services/pricing-api';
import type { CostEstimate } from '../types';

export function costEstimateMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'INVALID_DURATION') {
      return 'Add a valid estimated duration before calculating cost.';
    }
    if (error.code === 'COST_ESTIMATE_UNAVAILABLE' || error.code === 'PRICING_CONFIGURATION_ERROR') {
      return "We couldn't calculate the estimate right now.";
    }
  }
  return "We couldn't calculate the estimate right now.";
}

export function useCostEstimate(taskId: string | undefined) {
  const [estimate, setEstimate] = useState<CostEstimate | null>(null);
  const [loading, setLoading] = useState(Boolean(taskId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId) {
      setEstimate(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getCostEstimate(taskId)
      .then((response) => {
        if (cancelled) {
          return;
        }
        setEstimate(response.estimate);
        setLoading(false);
      })
      .catch((caught: unknown) => {
        if (cancelled) {
          return;
        }
        setEstimate(null);
        setError(costEstimateMessage(caught));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  return { estimate, loading, error };
}
