import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, userFacingAuthMessage } from '../../../services/api/client';
import { getTask } from '../../tasks/services/tasks-api';
import type { TaskView } from '../../tasks/types';
import { listRecommendations } from '../services/matching-api';
import type { Recommendation } from '../types';

export function useTaskRecommendations(taskId: string | undefined) {
  const navigate = useNavigate();
  const [task, setTask] = useState<TaskView | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId) {
      setError('That task was not found.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([getTask(taskId), listRecommendations(taskId)])
      .then(([taskResponse, recs]) => {
        if (cancelled) {
          return;
        }
        setTask(taskResponse.task);
        setRecommendations(recs.recommendations);
        setLoading(false);
      })
      .catch((caught: unknown) => {
        if (cancelled) {
          return;
        }
        if (caught instanceof ApiError && (caught.status === 401 || caught.code === 'UNAUTHORIZED')) {
          navigate('/login', { replace: true });
          return;
        }
        setError(userFacingAuthMessage(caught));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate, taskId]);

  return { task, recommendations, loading, error };
}
