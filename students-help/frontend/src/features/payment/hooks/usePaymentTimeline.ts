import { useEffect, useState } from 'react';
import { userFacingAuthMessage } from '../../../services/api/client';
import { getPaymentTimeline } from '../services/payment-api';
import type { PaymentTimelineView } from '../types';

export function usePaymentTimeline(
  bookingId: string | undefined,
  enabled: boolean,
  revision?: string,
) {
  const [timeline, setTimeline] = useState<PaymentTimelineView | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !bookingId) {
      setLoading(false);
      setTimeline(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    getPaymentTimeline(bookingId)
      .then((response) => {
        if (!cancelled) {
          setTimeline(response.paymentTimeline);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(userFacingAuthMessage(reason));
          setTimeline(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [bookingId, enabled, revision]);

  return { timeline, loading, error };
}
