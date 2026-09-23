import type {
  BookingProgress,
  BookingStatus,
  BookingStatusEvent,
  BookingView,
  ProgressAudience,
} from './types';

function occurredAt(
  history: BookingStatusEvent[],
  status: BookingStatus,
  fallback: string | null,
): string | null {
  return history.find((event) => event.status === status)?.createdAt ?? fallback;
}

function summaryFor(status: BookingStatus, audience: ProgressAudience): string {
  if (status === 'REJECTED') {
    return audience === 'STUDENT'
      ? 'You declined this booking request.'
      : 'The Student declined this booking request.';
  }
  if (status === 'CANCELLED') {
    return 'This booking was cancelled.';
  }
  if (status === 'AWAITING_SIGNOFF') {
    return audience === 'STUDENT'
      ? 'You marked this task as done. The Help Seeker needs to confirm completion.'
      : 'Student has marked the task as done. Confirmation is required.';
  }
  if (status === 'COMPLETED') {
    return 'This booking is completed.';
  }
  if (status === 'IN_PROGRESS') {
    return 'Task in progress';
  }
  if (status === 'CONFIRMED') {
    return 'This booking is confirmed.';
  }
  if (status === 'ACCEPTED') {
    return 'Your booking is not confirmed yet. Payment authorization is not available yet.';
  }
  if (audience === 'STUDENT') {
    return 'This booking is not confirmed yet. Accept or reject the request.';
  }
  return 'Your booking is not confirmed yet. The Student needs to accept your request first.';
}

export function buildBookingProgress(input: {
  status: BookingStatus;
  createdAt: string;
  updatedAt: string;
  rejectedAt: string | null;
  statusHistory: BookingStatusEvent[];
  audience: ProgressAudience;
}): BookingProgress {
  const { status, createdAt, updatedAt, rejectedAt, statusHistory, audience } = input;
  const requestAt = occurredAt(statusHistory, 'PENDING', createdAt);
  const afterAccept =
    status === 'ACCEPTED' ||
    status === 'CONFIRMED' ||
    status === 'IN_PROGRESS' ||
    status === 'AWAITING_SIGNOFF' ||
    status === 'COMPLETED';
  const afterConfirm =
    status === 'CONFIRMED' ||
    status === 'IN_PROGRESS' ||
    status === 'AWAITING_SIGNOFF' ||
    status === 'COMPLETED';
  const acceptedAt = occurredAt(statusHistory, 'ACCEPTED', afterAccept ? updatedAt : null);
  const confirmedAt = occurredAt(statusHistory, 'CONFIRMED', afterConfirm ? updatedAt : null);
  const declinedAt = occurredAt(statusHistory, 'REJECTED', rejectedAt);

  if (status === 'REJECTED') {
    return {
      summary: summaryFor(status, audience),
      steps: [
        { id: 'REQUEST', label: 'Request sent', state: 'complete', occurredAt: requestAt },
        { id: 'DECLINED', label: 'Student declined', state: 'declined', occurredAt: declinedAt },
      ],
    };
  }

  if (status === 'CANCELLED') {
    return {
      summary: summaryFor(status, audience),
      steps: [
        { id: 'REQUEST', label: 'Request sent', state: 'complete', occurredAt: requestAt },
        { id: 'DECLINED', label: 'Booking cancelled', state: 'declined', occurredAt: updatedAt },
      ],
    };
  }

  return {
    summary: summaryFor(status, audience),
    steps: [
      { id: 'REQUEST', label: 'Request sent', state: 'complete', occurredAt: requestAt },
      {
        id: 'ACCEPT',
        label: status === 'PENDING' ? 'Waiting for Student' : 'Student accepted',
        state: status === 'PENDING' ? 'current' : 'complete',
        occurredAt: status === 'PENDING' ? null : acceptedAt,
      },
      {
        id: 'HOLD',
        label: status === 'ACCEPTED' ? 'Payment authorization pending' : 'Payment authorization',
        state: status === 'ACCEPTED' ? 'current' : 'upcoming',
        occurredAt: null,
      },
      {
        id: 'CONFIRMED',
        label: 'Booking confirmed',
        state: afterConfirm ? 'complete' : 'upcoming',
        occurredAt: afterConfirm ? confirmedAt : null,
      },
    ],
  };
}

export function resolveBookingProgress(booking: BookingView, audience: ProgressAudience): BookingProgress {
  if (booking.progress) {
    return booking.progress;
  }
  return buildBookingProgress({
    status: booking.status,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    rejectedAt: booking.rejectedAt,
    statusHistory: booking.statusHistory ?? [],
    audience,
  });
}

export function headingForBookingStatus(status: BookingStatus, audience: ProgressAudience): string {
  if (status === 'REJECTED') {
    return 'Booking declined';
  }
  if (status === 'CANCELLED') {
    return 'Booking cancelled';
  }
  if (status === 'AWAITING_SIGNOFF') {
    return 'Waiting for confirmation';
  }
  if (status === 'COMPLETED') {
    return 'Task completed';
  }
  if (status === 'IN_PROGRESS') {
    return 'Task in progress';
  }
  if (status === 'CONFIRMED') {
    return 'Booking confirmed';
  }
  if (status === 'ACCEPTED') {
    return audience === 'STUDENT' ? 'Booking accepted' : 'Student accepted';
  }
  return audience === 'STUDENT' ? 'Booking Request' : 'Booking request sent';
}
