import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, userFacingAuthMessage } from '../../../services/api/client';
import { helpSeekerConfirmErrorMessage } from '../confirm-errors';
import { confirmCompletion, getBooking } from '../services/booking-api';
import { canConfirmCompletion, type BookingView } from '../types';

export function useBooking(bookingId: string | undefined) {
  const navigate = useNavigate();
  const [booking, setBooking] = useState<BookingView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmingCompletion, setConfirmingCompletion] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const bookingRef = useRef<BookingView | null>(null);

  const load = useCallback(async () => {
    if (!bookingId) {
      setError('That booking was not found.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await getBooking(bookingId);
      bookingRef.current = response.booking;
      setBooking(response.booking);
      setLoading(false);
    } catch (caught: unknown) {
      if (caught instanceof ApiError && (caught.status === 401 || caught.code === 'UNAUTHORIZED')) {
        navigate('/login', { replace: true });
        return;
      }
      if (caught instanceof ApiError && caught.code === 'FORBIDDEN') {
        setError('You cannot view this booking.');
        setLoading(false);
        return;
      }
      setError(userFacingAuthMessage(caught));
      setLoading(false);
    }
  }, [bookingId, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  function openConfirmCompletion(): void {
    if (!booking || !canConfirmCompletion(booking.status) || submitting) {
      return;
    }
    setActionError(null);
    setConfirmingCompletion(true);
  }

  function closeDialog(): void {
    if (!submitting) {
      setConfirmingCompletion(false);
    }
  }

  async function submitConfirmation(): Promise<void> {
    if (!bookingId || submitting) {
      return;
    }
    setSubmitting(true);
    setActionError(null);
    try {
      const response = await confirmCompletion(bookingId);
      bookingRef.current = response.booking;
      setBooking(response.booking);
      setConfirmingCompletion(false);
      setSubmitting(false);
    } catch (caught: unknown) {
      if (caught instanceof ApiError && (caught.status === 401 || caught.code === 'UNAUTHORIZED')) {
        navigate('/login', { replace: true });
        return;
      }
      setActionError(helpSeekerConfirmErrorMessage(caught));
      setSubmitting(false);
      setConfirmingCompletion(false);
      try {
        const refreshed = await getBooking(bookingId);
        bookingRef.current = refreshed.booking;
        setBooking(refreshed.booking);
      } catch {
        setBooking(bookingRef.current);
      }
    }
  }

  return {
    booking,
    loading,
    error,
    actionError,
    confirmingCompletion,
    submitting,
    canConfirmCompletion: booking ? canConfirmCompletion(booking.status) : false,
    openConfirmCompletion,
    closeDialog,
    submitConfirmation,
  };
}
