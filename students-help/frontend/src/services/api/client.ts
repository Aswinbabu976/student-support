import type { ApiErrorBody } from '../../features/auth/types/auth';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Array<{ field?: string; message: string }>;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.details = body.details ?? [];
  }

  fieldMessage(field: string): string | undefined {
    return this.details.find((detail) => detail.field === field)?.message;
  }
}

const DEFAULT_MESSAGES: Record<string, string> = {
  UNSUPPORTED_UNIVERSITY_EMAIL:
    'Use a supported university email address to register as a Student.',
  EMAIL_ALREADY_REGISTERED: 'An account already exists for this email.',
  VALIDATION_ERROR: 'The submitted data is invalid.',
  INVALID_VERIFICATION_TOKEN: 'This verification link is invalid.',
  EXPIRED_VERIFICATION_TOKEN: 'This verification link has expired.',
  INVALID_PAYMENT_METHOD: 'Choose a supported payment preference.',
  INVALID_CREDENTIALS: 'Email or password is incorrect.',
  UNAUTHORIZED: 'Sign in to continue.',
  FORBIDDEN: 'You do not have access to this page.',
  SKILL_NOT_FOUND: 'That skill is not available.',
  STUDENT_SKILL_ALREADY_EXISTS: "You've already added this skill.",
  STUDENT_SKILL_NOT_FOUND: 'That skill is not on your profile.',
  INVALID_TIME_RANGE: 'End time must be later than start time.',
  AVAILABILITY_SLOT_OVERLAP: 'This time overlaps with another availability slot.',
  INVALID_DATE_RANGE: 'End date must be on or after the start date.',
  UNAVAILABLE_PERIOD_OVERLAP: 'This period overlaps with another unavailable period.',
  UNAVAILABLE_PERIOD_NOT_FOUND: 'That unavailable period is not on your profile.',
  TASK_SKILL_REQUIRED: 'Select at least one required skill.',
  INVALID_TASK_DATE: 'Choose a future date and time.',
  INVALID_DURATION: 'Enter a valid estimated duration.',
  INVALID_LOCATION: 'Enter a location for this task.',
  TASK_NOT_FOUND: 'That task was not found.',
  TASK_NOT_PUBLISHED: 'Publish this task before requesting Student recommendations.',
  TASK_CREATION_FAILED: 'The task could not be created.',
  MATCHING_SERVICE_ERROR: 'Recommendations could not be loaded.',
  STUDENT_NOT_FOUND: 'That Student was not found.',
  STUDENT_NOT_ELIGIBLE: 'This Student cannot be booked for this task.',
  STUDENT_NOT_AVAILABLE: 'This Student is no longer available at the selected time.',
  BOOKING_REQUEST_ALREADY_EXISTS: 'You already sent a booking request to this Student for this task.',
  TASK_NOT_BOOKABLE: 'This task can no longer accept booking requests.',
  BOOKING_NOT_FOUND: 'That booking was not found.',
  BOOKING_CREATION_FAILED: 'The booking request could not be sent.',
  BOOKING_NOT_PENDING: 'This booking request is no longer available.',
  BOOKING_ALREADY_ACCEPTED: 'This booking has already been accepted.',
  BOOKING_REJECTED: 'This booking request was rejected.',
  BOOKING_CANCELLED: 'This booking was cancelled.',
  BOOKING_CONFLICT: 'You already have another booking during this time.',
  COST_ESTIMATE_UNAVAILABLE: "We couldn't calculate the estimate right now.",
  PRICING_CONFIGURATION_ERROR: "We couldn't calculate the estimate right now.",
  BOOKING_NOT_PAYMENT_ELIGIBLE:
    'Payment authorization is only available after the Student accepts this booking.',
  PAYMENT_METHOD_REQUIRED: 'A payment method is required before this booking can be authorized.',
  PAYMENT_AUTHORIZATION_FAILED: 'Payment authorization was declined.',
  PAYMENT_PROVIDER_ERROR: 'The payment provider could not complete authorization.',
  PAYMENT_ALREADY_AUTHORIZED: 'Payment for this booking is already authorized.',
  PAYMENT_NOT_FOUND: 'Payment has not been initiated for this booking yet.',
  PAYMENT_STATE_UNAVAILABLE: "We couldn't load payment information right now.",
  PAYMENT_TIMELINE_UNAVAILABLE: "We couldn't load payment information right now.",
  BOOKING_NOT_CONFIRMED: 'This booking is not ready to start yet.',
  TASK_ALREADY_STARTED: 'This task has already been started.',
  PAYMENT_NOT_AUTHORIZED: 'This task cannot be started until payment authorization is complete.',
  INVALID_STATE_TRANSITION: 'This booking cannot change to that status.',
  TASK_CANCELLED: 'This booking was cancelled.',
  TASK_NOT_IN_PROGRESS: 'This task is not currently in progress.',
  TASK_NOT_STARTED: 'This task has not been started.',
  TASK_ALREADY_SUBMITTED: 'This task has already been submitted for confirmation.',
  TASK_NOT_AWAITING_SIGNOFF: 'This task is not waiting for confirmation.',
  TASK_ALREADY_COMPLETED: 'This task has already been completed.',
  TASK_NOT_SUBMITTED: 'The Student has not submitted this task for confirmation yet.',
};

export function userFacingAuthMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return DEFAULT_MESSAGES[error.code] ?? error.message;
  }
  return 'The request could not be completed. Try again.';
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? '';
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const body = (await response.json().catch(() => null)) as ApiErrorBody | T | null;

  if (!response.ok) {
    const errorBody: ApiErrorBody = {
      code: (body as ApiErrorBody | null)?.code ?? 'INTERNAL_ERROR',
      message:
        (body as ApiErrorBody | null)?.message ?? 'The request could not be completed.',
      details: (body as ApiErrorBody | null)?.details ?? [],
    };
    throw new ApiError(response.status, errorBody);
  }

  return body as T;
}
