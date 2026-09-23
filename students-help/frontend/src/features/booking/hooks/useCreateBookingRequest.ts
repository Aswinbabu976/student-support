import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, userFacingAuthMessage } from '../../../services/api/client';
import { listRecommendations } from '../../matching/services/matching-api';
import type { Recommendation } from '../../matching/types';
import { getTask } from '../../tasks/services/tasks-api';
import type { TaskView } from '../../tasks/types';
import { createBookingRequest } from '../services/booking-api';

export function useCreateBookingRequest(taskId: string | undefined, studentId: string | undefined) {
  const navigate = useNavigate();
  const [task, setTask] = useState<TaskView | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId || !studentId) {
      setError('That booking request could not be opened.');
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
        setRecommendation(recs.recommendations.find((row) => row.student.id === studentId) ?? null);
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
  }, [navigate, studentId, taskId]);

  async function submit(): Promise<void> {
    if (!taskId || !studentId || submitting) {
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const response = await createBookingRequest(taskId, studentId);
      navigate(`/help-seeker/bookings/${response.booking.id}`, { replace: true });
    } catch (caught: unknown) {
      if (caught instanceof ApiError && (caught.status === 401 || caught.code === 'UNAUTHORIZED')) {
        navigate('/login', { replace: true });
        return;
      }
      setSubmitError(userFacingAuthMessage(caught));
      setSubmitting(false);
    }
  }

  return { task, recommendation, loading, error, submitting, submitError, submit };
}
