import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../../../services/api/client';
import { studentAcceptErrorMessage } from '../accept-errors';
import { studentDoneErrorMessage } from '../done-errors';
import { studentRejectErrorMessage } from '../reject-errors';
import { studentStartErrorMessage } from '../start-errors';
import { acceptBooking, getBooking, markBookingDone, rejectBooking, startBooking } from '../services/booking-api';
import {
  canAcceptBooking,
  canRejectBooking,
  canStartBooking,
  canSubmitCompletion,
  type BookingView,
} from '../types';

export function useStudentBookingRequest(bookingId: string | undefined) {
  const navigate = useNavigate();
  const [booking, setBooking] = useState<BookingView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmingAccept, setConfirmingAccept] = useState(false);
  const [confirmingReject, setConfirmingReject] = useState(false);
  const [confirmingStart, setConfirmingStart] = useState(false);
  const [confirmingDone, setConfirmingDone] = useState(false);
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
      setError(studentAcceptErrorMessage(caught));
      setLoading(false);
    }
  }, [bookingId, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  function openAccept(): void {
    if (!booking || !canAcceptBooking(booking.status) || submitting) {
      return;
    }
    setActionError(null);
    setConfirmingReject(false);
    setConfirmingStart(false);
    setConfirmingDone(false);
    setConfirmingAccept(true);
  }

  function openReject(): void {
    if (!booking || !canRejectBooking(booking.status) || submitting) {
      return;
    }
    setActionError(null);
    setConfirmingAccept(false);
    setConfirmingStart(false);
    setConfirmingDone(false);
    setConfirmingReject(true);
  }

  function openStart(): void {
    if (!booking || !canStartBooking(booking.status) || submitting) {
      return;
    }
    setActionError(null);
    setConfirmingAccept(false);
    setConfirmingReject(false);
    setConfirmingDone(false);
    setConfirmingStart(true);
  }

  function openDone(): void {
    if (!booking || !canSubmitCompletion(booking.status) || submitting) {
      return;
    }
    setActionError(null);
    setConfirmingAccept(false);
    setConfirmingReject(false);
    setConfirmingStart(false);
    setConfirmingDone(true);
  }

  function closeDialog(): void {
    if (!submitting) {
      setConfirmingAccept(false);
      setConfirmingReject(false);
      setConfirmingStart(false);
      setConfirmingDone(false);
    }
  }

  async function refreshAfterFailure(caught: unknown, mapError: (error: unknown) => string): Promise<void> {
    if (caught instanceof ApiError && (caught.status === 401 || caught.code === 'UNAUTHORIZED')) {
      navigate('/login', { replace: true });
      return;
    }
    setActionError(mapError(caught));
    setSubmitting(false);
    setConfirmingAccept(false);
    setConfirmingReject(false);
    setConfirmingStart(false);
    setConfirmingDone(false);
    try {
      const refreshed = await getBooking(bookingId!);
      bookingRef.current = refreshed.booking;
      setBooking(refreshed.booking);
    } catch {
      setBooking(bookingRef.current);
    }
  }

  async function confirmAccept(): Promise<void> {
    if (!bookingId || submitting) {
      return;
    }
    setSubmitting(true);
    setActionError(null);
    try {
      const response = await acceptBooking(bookingId);
      bookingRef.current = response.booking;
      setBooking(response.booking);
      setConfirmingAccept(false);
      setSubmitting(false);
    } catch (caught: unknown) {
      await refreshAfterFailure(caught, studentAcceptErrorMessage);
    }
  }

  async function confirmReject(reason: string): Promise<void> {
    if (!bookingId || submitting) {
      return;
    }
    setSubmitting(true);
    setActionError(null);
    try {
      const response = await rejectBooking(bookingId, reason);
      bookingRef.current = response.booking;
      setBooking(response.booking);
      setConfirmingReject(false);
      setSubmitting(false);
    } catch (caught: unknown) {
      await refreshAfterFailure(caught, studentRejectErrorMessage);
    }
  }

  async function confirmStart(): Promise<void> {
    if (!bookingId || submitting) {
      return;
    }
    setSubmitting(true);
    setActionError(null);
    try {
      const response = await startBooking(bookingId);
      bookingRef.current = response.booking;
      setBooking(response.booking);
      setConfirmingStart(false);
      setSubmitting(false);
    } catch (caught: unknown) {
      await refreshAfterFailure(caught, studentStartErrorMessage);
    }
  }

  async function confirmDone(): Promise<void> {
    if (!bookingId || submitting) {
      return;
    }
    setSubmitting(true);
    setActionError(null);
    try {
      const response = await markBookingDone(bookingId);
      bookingRef.current = response.booking;
      setBooking(response.booking);
      setConfirmingDone(false);
      setSubmitting(false);
    } catch (caught: unknown) {
      await refreshAfterFailure(caught, studentDoneErrorMessage);
    }
  }

  return {
    booking,
    loading,
    error,
    confirmingAccept,
    confirmingReject,
    confirmingStart,
    confirmingDone,
    submitting,
    actionError,
    canAccept: booking ? canAcceptBooking(booking.status) : false,
    canReject: booking ? canRejectBooking(booking.status) : false,
    canStart: booking ? canStartBooking(booking.status) : false,
    canComplete: booking ? canSubmitCompletion(booking.status) : false,
    openAccept,
    openReject,
    openStart,
    openDone,
    closeDialog,
    confirmAccept,
    confirmReject,
    confirmStart,
    confirmDone,
  };
}
