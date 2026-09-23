import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, userFacingAuthMessage } from '../../../services/api/client';
import { getTask } from '../services/tasks-api';
import type { TaskView } from '../types';

export function useTaskDetails(taskId: string | undefined) {
  const navigate = useNavigate();
  const [task, setTask] = useState<TaskView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!taskId) {
      setError('That task was not found.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    getTask(taskId)
      .then((response) => {
        if (!cancelled) {
          setTask(response.task);
          setLoading(false);
        }
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

  return { task, error, loading };
}
