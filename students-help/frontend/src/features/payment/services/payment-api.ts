import { apiRequest } from '../../../services/api/client';
import type { PaymentResponse, PaymentTimelineResponse, PaymentView } from '../types';

export function getPayment(bookingId: string): Promise<PaymentResponse> {
  return apiRequest<PaymentResponse>(`/bookings/${bookingId}/payment`);
}

export function authorizePayment(bookingId: string): Promise<{ payment: PaymentView }> {
  return apiRequest<{ payment: PaymentView }>(`/bookings/${bookingId}/payment/authorization`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function getPaymentTimeline(bookingId: string): Promise<PaymentTimelineResponse> {
  return apiRequest<PaymentTimelineResponse>(`/bookings/${bookingId}/payment-timeline`);
}

