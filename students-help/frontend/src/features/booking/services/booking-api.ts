import { apiRequest } from '../../../services/api/client';
import type { BookingResponse, CreateBookingResponse } from '../types';

export function createBookingRequest(
  taskId: string,
  studentId: string,
): Promise<CreateBookingResponse> {
  return apiRequest<CreateBookingResponse>(`/tasks/${taskId}/bookings`, {
    method: 'POST',
    body: JSON.stringify({ studentId }),
  });
}

export function getBooking(bookingId: string): Promise<BookingResponse> {
  return apiRequest<BookingResponse>(`/bookings/${bookingId}`);
}

export function acceptBooking(bookingId: string): Promise<CreateBookingResponse> {
  return apiRequest<CreateBookingResponse>(`/bookings/${bookingId}/accept`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function startBooking(bookingId: string): Promise<CreateBookingResponse> {
  return apiRequest<CreateBookingResponse>(`/bookings/${bookingId}/start`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function markBookingDone(bookingId: string): Promise<CreateBookingResponse> {
  return apiRequest<CreateBookingResponse>(`/bookings/${bookingId}/done`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function confirmCompletion(bookingId: string): Promise<CreateBookingResponse> {
  return apiRequest<CreateBookingResponse>(`/bookings/${bookingId}/confirm-completion`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function rejectBooking(bookingId: string, reason: string): Promise<CreateBookingResponse> {
  return apiRequest<CreateBookingResponse>(`/bookings/${bookingId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}
