import { useCallback, useEffect, useRef, useState } from 'react';
import { userFacingAuthMessage } from '../../../services/api/client';
import { authorizePayment, getPayment } from '../services/payment-api';
import type { PaymentView } from '../types';

export function usePaymentAuthorization(bookingId: string | undefined, enabled: boolean) {
  const [payment, setPayment] = useState<PaymentView | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!enabled || !bookingId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    getPayment(bookingId)
      .then((response) => {
        if (!cancelled) {
          setPayment(response.payment);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(userFacingAuthMessage(reason));
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
  }, [bookingId, enabled]);

  const authorize = useCallback(async () => {
    if (!bookingId || submittingRef.current) {
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const response = await authorizePayment(bookingId);
      setPayment(response.payment);
    } catch (reason: unknown) {
      setError(userFacingAuthMessage(reason));
      try {
        const latest = await getPayment(bookingId);
        setPayment(latest.payment);
      } catch {
        setPayment(null);
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [bookingId]);

  return { payment, loading, submitting, error, authorize };
}
