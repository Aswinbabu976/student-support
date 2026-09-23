export type ProgressStepState = 'complete' | 'current' | 'upcoming' | 'declined';
export type ProgressStepId = 'REQUEST' | 'ACCEPT' | 'HOLD' | 'CONFIRMED' | 'DECLINED';
export type ProgressAudience = 'HELP_SEEKER' | 'STUDENT';

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

export type BookingStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'AWAITING_SIGNOFF'
  | 'COMPLETED';

export type BookingStatusEvent = {
  status: BookingStatus;
  createdAt: string;
};

export const REJECTION_REASON_MIN_LENGTH = 8;
export const REJECTION_REASON_MAX_LENGTH = 280;

export function canAcceptBooking(status: BookingStatus): boolean {
  return status === 'PENDING';
}

export function canRejectBooking(status: BookingStatus): boolean {
  return status === 'PENDING';
}

export function canStartBooking(status: BookingStatus): boolean {
  return status === 'CONFIRMED';
}

export function canSubmitCompletion(status: BookingStatus): boolean {
  return status === 'IN_PROGRESS';
}

export function canConfirmCompletion(status: BookingStatus): boolean {
  return status === 'AWAITING_SIGNOFF';
}

export function rejectionReasonError(reason: string): string | null {
  const trimmed = reason.trim();
  if (!trimmed) {
    return 'A short reason is required.';
  }
  if (trimmed.length < REJECTION_REASON_MIN_LENGTH) {
    return `Reason must be at least ${REJECTION_REASON_MIN_LENGTH} characters.`;
  }
  if (trimmed.length > REJECTION_REASON_MAX_LENGTH) {
    return `Reason must be ${REJECTION_REASON_MAX_LENGTH} characters or fewer.`;
  }
  return null;
}

export type BookingStudent = {
  id: string;
  verificationStatus: 'VERIFIED' | 'UNVERIFIED';
};

export type BookingTask = {
  id: string;
  title: string;
  description: string;
  skills: Array<{ id: string; name: string; category: string }>;
  location: { addressLine: string };
  timezone: string;
  preferredDate: string;
  preferredTime: string;
  preferredStartAt: string;
  estimatedDurationMinutes: number;
  specialInstructions: string | null;
  status: string;
};

export type BookingView = {
  id: string;
  status: BookingStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  submittedForSignoffAt?: string | null;
  completedAt?: string | null;
  rejectionReason: string | null;
  rejectedAt: string | null;
  statusHistory?: BookingStatusEvent[];
  progress?: BookingProgress;
  task: BookingTask;
  student: BookingStudent;
};

export type CreateBookingResponse = {
  booking: BookingView;
  message: string;
};

export type BookingResponse = {
  booking: BookingView;
};
