import { BookingStatus } from '@prisma/client';

export type ProgressStepState = 'complete' | 'current' | 'upcoming' | 'declined';

export type ProgressStepId = 'REQUEST' | 'ACCEPT' | 'HOLD' | 'CONFIRMED' | 'DECLINED';

export type BookingProgressStep = {
  id: ProgressStepId;
  label: string;
  state: ProgressStepState;
  occurredAt: string | null;
};

export type BookingProgress = {
  steps: BookingProgressStep[];
  summary: string;
};

export type BookingStatusEvent = {
  status: BookingStatus;
  createdAt: string;
};

export type ProgressAudience = 'HELP_SEEKER' | 'STUDENT';

function occurredAt(history: BookingStatusEvent[], status: BookingStatus, fallback: string | null): string | null {
  return history.find((event) => event.status === status)?.createdAt ?? fallback;
}

function summaryFor(status: BookingStatus, audience: ProgressAudience): string {
  if (status === BookingStatus.REJECTED) {
    return audience === 'STUDENT'
      ? 'You declined this booking request.'
      : 'The Student declined this booking request.';
  }
  if (status === BookingStatus.CANCELLED) {
    return 'This booking was cancelled.';
  }
  if (status === BookingStatus.AWAITING_SIGNOFF) {
    return audience === 'STUDENT'
      ? 'You marked this task as done. The Help Seeker needs to confirm completion.'
      : 'Student has marked the task as done. Confirmation is required.';
  }
  if (status === BookingStatus.COMPLETED) {
    return 'This booking is completed.';
  }
  if (status === BookingStatus.IN_PROGRESS) {
    return 'Task in progress';
  }
  if (status === BookingStatus.CONFIRMED) {
    return 'This booking is confirmed.';
  }
  if (status === BookingStatus.ACCEPTED) {
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
  const requestAt = occurredAt(statusHistory, BookingStatus.PENDING, createdAt);
  const afterAccept =
    status === BookingStatus.ACCEPTED ||
    status === BookingStatus.CONFIRMED ||
    status === BookingStatus.IN_PROGRESS ||
    status === BookingStatus.AWAITING_SIGNOFF ||
    status === BookingStatus.COMPLETED;
  const afterConfirm =
    status === BookingStatus.CONFIRMED ||
    status === BookingStatus.IN_PROGRESS ||
    status === BookingStatus.AWAITING_SIGNOFF ||
    status === BookingStatus.COMPLETED;
  const acceptedAt = occurredAt(
    statusHistory,
    BookingStatus.ACCEPTED,
    afterAccept ? updatedAt : null,
  );
  const confirmedAt = occurredAt(
    statusHistory,
    BookingStatus.CONFIRMED,
    afterConfirm ? updatedAt : null,
  );
  const declinedAt = occurredAt(statusHistory, BookingStatus.REJECTED, rejectedAt);

  if (status === BookingStatus.REJECTED) {
    return {
      summary: summaryFor(status, audience),
      steps: [
        { id: 'REQUEST', label: 'Request sent', state: 'complete', occurredAt: requestAt },
        { id: 'DECLINED', label: 'Student declined', state: 'declined', occurredAt: declinedAt },
      ],
    };
  }

  if (status === BookingStatus.CANCELLED) {
    return {
      summary: summaryFor(status, audience),
      steps: [
        { id: 'REQUEST', label: 'Request sent', state: 'complete', occurredAt: requestAt },
        { id: 'DECLINED', label: 'Booking cancelled', state: 'declined', occurredAt: updatedAt },
      ],
    };
  }

  const request: BookingProgressStep = {
    id: 'REQUEST',
    label: 'Request sent',
    state: 'complete',
    occurredAt: requestAt,
  };
  const accept: BookingProgressStep = {
    id: 'ACCEPT',
    label:
      status === BookingStatus.PENDING ? 'Waiting for Student' : 'Student accepted',
    state: status === BookingStatus.PENDING ? 'current' : 'complete',
    occurredAt: status === BookingStatus.PENDING ? null : acceptedAt,
  };
  const hold: BookingProgressStep = {
    id: 'HOLD',
    label: status === BookingStatus.ACCEPTED ? 'Payment authorization pending' : 'Payment authorization',
    state: status === BookingStatus.ACCEPTED ? 'current' : 'upcoming',
    occurredAt: null,
  };
  const confirmed: BookingProgressStep = {
    id: 'CONFIRMED',
    label: 'Booking confirmed',
    state: afterConfirm ? 'complete' : 'upcoming',
    occurredAt: afterConfirm ? confirmedAt : null,
  };

  if (status === BookingStatus.CONFIRMED || afterConfirm) {
    hold.label = 'Payment authorization';
    hold.state = 'upcoming';
  }

  return {
    summary: summaryFor(status, audience),
    steps: [request, accept, hold, confirmed],
  };
}
