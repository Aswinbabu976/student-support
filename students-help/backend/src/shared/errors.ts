export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNSUPPORTED_UNIVERSITY_EMAIL: 'UNSUPPORTED_UNIVERSITY_EMAIL',
  EMAIL_ALREADY_REGISTERED: 'EMAIL_ALREADY_REGISTERED',
  INVALID_VERIFICATION_TOKEN: 'INVALID_VERIFICATION_TOKEN',
  EXPIRED_VERIFICATION_TOKEN: 'EXPIRED_VERIFICATION_TOKEN',
  INVALID_PAYMENT_METHOD: 'INVALID_PAYMENT_METHOD',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  REGISTRATION_FAILED: 'REGISTRATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  SKILL_NOT_FOUND: 'SKILL_NOT_FOUND',
  STUDENT_SKILL_ALREADY_EXISTS: 'STUDENT_SKILL_ALREADY_EXISTS',
  STUDENT_SKILL_NOT_FOUND: 'STUDENT_SKILL_NOT_FOUND',
  INVALID_TIME_RANGE: 'INVALID_TIME_RANGE',
  AVAILABILITY_SLOT_OVERLAP: 'AVAILABILITY_SLOT_OVERLAP',
  INVALID_DATE_RANGE: 'INVALID_DATE_RANGE',
  UNAVAILABLE_PERIOD_OVERLAP: 'UNAVAILABLE_PERIOD_OVERLAP',
  UNAVAILABLE_PERIOD_NOT_FOUND: 'UNAVAILABLE_PERIOD_NOT_FOUND',
  TASK_SKILL_REQUIRED: 'TASK_SKILL_REQUIRED',
  INVALID_TASK_DATE: 'INVALID_TASK_DATE',
  INVALID_DURATION: 'INVALID_DURATION',
  INVALID_LOCATION: 'INVALID_LOCATION',
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  TASK_NOT_PUBLISHED: 'TASK_NOT_PUBLISHED',
  TASK_CREATION_FAILED: 'TASK_CREATION_FAILED',
  MATCHING_SERVICE_ERROR: 'MATCHING_SERVICE_ERROR',
  STUDENT_NOT_FOUND: 'STUDENT_NOT_FOUND',
  STUDENT_NOT_ELIGIBLE: 'STUDENT_NOT_ELIGIBLE',
  STUDENT_NOT_AVAILABLE: 'STUDENT_NOT_AVAILABLE',
  BOOKING_REQUEST_ALREADY_EXISTS: 'BOOKING_REQUEST_ALREADY_EXISTS',
  TASK_NOT_BOOKABLE: 'TASK_NOT_BOOKABLE',
  BOOKING_NOT_FOUND: 'BOOKING_NOT_FOUND',
  BOOKING_CREATION_FAILED: 'BOOKING_CREATION_FAILED',
  BOOKING_NOT_PENDING: 'BOOKING_NOT_PENDING',
  BOOKING_ALREADY_ACCEPTED: 'BOOKING_ALREADY_ACCEPTED',
  BOOKING_REJECTED: 'BOOKING_REJECTED',
  BOOKING_CANCELLED: 'BOOKING_CANCELLED',
  BOOKING_CONFLICT: 'BOOKING_CONFLICT',
  COST_ESTIMATE_UNAVAILABLE: 'COST_ESTIMATE_UNAVAILABLE',
  PRICING_CONFIGURATION_ERROR: 'PRICING_CONFIGURATION_ERROR',
  BOOKING_NOT_PAYMENT_ELIGIBLE: 'BOOKING_NOT_PAYMENT_ELIGIBLE',
  PAYMENT_METHOD_REQUIRED: 'PAYMENT_METHOD_REQUIRED',
  PAYMENT_AUTHORIZATION_FAILED: 'PAYMENT_AUTHORIZATION_FAILED',
  PAYMENT_PROVIDER_ERROR: 'PAYMENT_PROVIDER_ERROR',
  PAYMENT_ALREADY_AUTHORIZED: 'PAYMENT_ALREADY_AUTHORIZED',
  PAYMENT_NOT_FOUND: 'PAYMENT_NOT_FOUND',
  PAYMENT_STATE_UNAVAILABLE: 'PAYMENT_STATE_UNAVAILABLE',
  PAYMENT_TIMELINE_UNAVAILABLE: 'PAYMENT_TIMELINE_UNAVAILABLE',
  BOOKING_NOT_CONFIRMED: 'BOOKING_NOT_CONFIRMED',
  TASK_ALREADY_STARTED: 'TASK_ALREADY_STARTED',
  PAYMENT_NOT_AUTHORIZED: 'PAYMENT_NOT_AUTHORIZED',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  TASK_CANCELLED: 'TASK_CANCELLED',
  TASK_NOT_IN_PROGRESS: 'TASK_NOT_IN_PROGRESS',
  TASK_NOT_STARTED: 'TASK_NOT_STARTED',
  TASK_ALREADY_SUBMITTED: 'TASK_ALREADY_SUBMITTED',
  TASK_NOT_AWAITING_SIGNOFF: 'TASK_NOT_AWAITING_SIGNOFF',
  TASK_ALREADY_COMPLETED: 'TASK_ALREADY_COMPLETED',
  TASK_NOT_SUBMITTED: 'TASK_NOT_SUBMITTED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: Array<{ field?: string; message: string }>;

  constructor(
    code: ErrorCode,
    message: string,
    status: number,
    details: Array<{ field?: string; message: string }> = [],
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function validationError(
  message: string,
  details: Array<{ field?: string; message: string }> = [],
): AppError {
  return new AppError(ErrorCode.VALIDATION_ERROR, message, 400, details);
}

export function unsupportedUniversityEmail(): AppError {
  return new AppError(
    ErrorCode.UNSUPPORTED_UNIVERSITY_EMAIL,
    'Use a supported university email address to register as a Student.',
    400,
    [{ field: 'email', message: 'Use a supported university email address to register as a Student.' }],
  );
}

export function emailAlreadyRegistered(): AppError {
  return new AppError(
    ErrorCode.EMAIL_ALREADY_REGISTERED,
    'An account already exists for this email.',
    409,
    [{ field: 'email', message: 'An account already exists for this email.' }],
  );
}

export function invalidVerificationToken(): AppError {
  return new AppError(
    ErrorCode.INVALID_VERIFICATION_TOKEN,
    'This verification link is invalid.',
    400,
    [{ field: 'token', message: 'This verification link is invalid.' }],
  );
}

export function expiredVerificationToken(): AppError {
  return new AppError(
    ErrorCode.EXPIRED_VERIFICATION_TOKEN,
    'This verification link has expired.',
    400,
    [{ field: 'token', message: 'This verification link has expired.' }],
  );
}

export function invalidPaymentMethod(): AppError {
  return new AppError(
    ErrorCode.INVALID_PAYMENT_METHOD,
    'Choose a supported payment preference.',
    400,
    [{ field: 'preferredPaymentMethod', message: 'Choose a supported payment preference.' }],
  );
}

export function invalidCredentials(): AppError {
  return new AppError(ErrorCode.INVALID_CREDENTIALS, 'Email or password is incorrect.', 401);
}

export function registrationFailed(): AppError {
  return new AppError(ErrorCode.REGISTRATION_FAILED, 'Registration could not be completed.', 500);
}

export function skillNotFound(): AppError {
  return new AppError(ErrorCode.SKILL_NOT_FOUND, 'That skill is not available.', 404, [
    { field: 'skillId', message: 'That skill is not available.' },
  ]);
}

export function studentSkillAlreadyExists(): AppError {
  return new AppError(
    ErrorCode.STUDENT_SKILL_ALREADY_EXISTS,
    "You've already added this skill.",
    409,
    [{ field: 'skillId', message: "You've already added this skill." }],
  );
}

export function studentSkillNotFound(): AppError {
  return new AppError(ErrorCode.STUDENT_SKILL_NOT_FOUND, 'That skill is not on your profile.', 404);
}

export function invalidTimeRange(message = 'End time must be later than start time.'): AppError {
  return new AppError(ErrorCode.INVALID_TIME_RANGE, message, 400, [
    { field: 'end', message },
  ]);
}

export function availabilitySlotOverlap(): AppError {
  return new AppError(
    ErrorCode.AVAILABILITY_SLOT_OVERLAP,
    'This time overlaps with another availability slot.',
    400,
    [{ field: 'slots', message: 'This time overlaps with another availability slot.' }],
  );
}

export function invalidDateRange(message = 'End date must be on or after the start date.'): AppError {
  return new AppError(ErrorCode.INVALID_DATE_RANGE, message, 400, [
    { field: 'endDate', message },
  ]);
}

export function unavailablePeriodOverlap(): AppError {
  return new AppError(
    ErrorCode.UNAVAILABLE_PERIOD_OVERLAP,
    'This period overlaps with another unavailable period.',
    409,
    [{ field: 'startDate', message: 'This period overlaps with another unavailable period.' }],
  );
}

export function unavailablePeriodNotFound(): AppError {
  return new AppError(
    ErrorCode.UNAVAILABLE_PERIOD_NOT_FOUND,
    'That unavailable period is not on your profile.',
    404,
  );
}

export function taskSkillRequired(): AppError {
  return new AppError(ErrorCode.TASK_SKILL_REQUIRED, 'Select at least one required skill.', 400, [
    { field: 'skillIds', message: 'Select at least one required skill.' },
  ]);
}

export function invalidTaskDate(message = 'Choose a future date and time.'): AppError {
  return new AppError(ErrorCode.INVALID_TASK_DATE, message, 400, [
    { field: 'preferredDate', message },
  ]);
}

export function invalidDuration(message = 'Enter a valid estimated duration.'): AppError {
  return new AppError(ErrorCode.INVALID_DURATION, message, 400, [
    { field: 'estimatedDurationMinutes', message },
  ]);
}

export function invalidLocation(message = 'Enter a location for this task.'): AppError {
  return new AppError(ErrorCode.INVALID_LOCATION, message, 400, [
    { field: 'location', message },
  ]);
}

export function taskNotFound(): AppError {
  return new AppError(ErrorCode.TASK_NOT_FOUND, 'That task was not found.', 404);
}

export function taskNotPublished(): AppError {
  return new AppError(
    ErrorCode.TASK_NOT_PUBLISHED,
    'Publish this task before requesting Student recommendations.',
    400,
  );
}

export function matchingServiceError(): AppError {
  return new AppError(ErrorCode.MATCHING_SERVICE_ERROR, 'Recommendations could not be loaded.', 500);
}

export function taskCreationFailed(): AppError {
  return new AppError(ErrorCode.TASK_CREATION_FAILED, 'The task could not be created.', 500);
}

export function studentNotFound(): AppError {
  return new AppError(ErrorCode.STUDENT_NOT_FOUND, 'That Student was not found.', 404);
}

export function studentNotEligible(): AppError {
  return new AppError(
    ErrorCode.STUDENT_NOT_ELIGIBLE,
    'This Student cannot be booked for this task.',
    400,
  );
}

export function studentNotAvailable(
  message = 'This Student is no longer available at the selected time.',
): AppError {
  return new AppError(ErrorCode.STUDENT_NOT_AVAILABLE, message, 409);
}

export function bookingRequestAlreadyExists(): AppError {
  return new AppError(
    ErrorCode.BOOKING_REQUEST_ALREADY_EXISTS,
    'You already sent a booking request to this Student for this task.',
    409,
  );
}

export function taskNotBookable(): AppError {
  return new AppError(
    ErrorCode.TASK_NOT_BOOKABLE,
    'This task can no longer accept booking requests.',
    400,
  );
}

export function bookingNotFound(): AppError {
  return new AppError(ErrorCode.BOOKING_NOT_FOUND, 'That booking was not found.', 404);
}

export function bookingCreationFailed(): AppError {
  return new AppError(ErrorCode.BOOKING_CREATION_FAILED, 'The booking request could not be sent.', 500);
}

export function bookingNotPending(): AppError {
  return new AppError(
    ErrorCode.BOOKING_NOT_PENDING,
    'This booking request is no longer available.',
    409,
  );
}

export function bookingAlreadyAccepted(): AppError {
  return new AppError(ErrorCode.BOOKING_ALREADY_ACCEPTED, 'This booking has already been accepted.', 409);
}

export function bookingRejected(): AppError {
  return new AppError(ErrorCode.BOOKING_REJECTED, 'This booking request was rejected.', 409);
}

export function bookingCancelled(): AppError {
  return new AppError(ErrorCode.BOOKING_CANCELLED, 'This booking was cancelled.', 409);
}

export function bookingConflict(): AppError {
  return new AppError(
    ErrorCode.BOOKING_CONFLICT,
    'You already have another booking during this time.',
    409,
  );
}

export function bookingUpdateFailed(): AppError {
  return new AppError(ErrorCode.INTERNAL_ERROR, 'The booking could not be updated.', 500);
}

export function pricingConfigurationError(): AppError {
  return new AppError(
    ErrorCode.PRICING_CONFIGURATION_ERROR,
    'We could not calculate the estimate right now.',
    500,
  );
}

export function costEstimateUnavailable(): AppError {
  return new AppError(
    ErrorCode.COST_ESTIMATE_UNAVAILABLE,
    'We could not calculate the estimate right now.',
    500,
  );
}

export function bookingNotPaymentEligible(): AppError {
  return new AppError(
    ErrorCode.BOOKING_NOT_PAYMENT_ELIGIBLE,
    'Payment authorization is only available after the Student accepts this booking.',
    409,
  );
}

export function paymentMethodRequired(): AppError {
  return new AppError(
    ErrorCode.PAYMENT_METHOD_REQUIRED,
    'A payment method is required before this booking can be authorized.',
    409,
  );
}

export function paymentAuthorizationFailed(): AppError {
  return new AppError(
    ErrorCode.PAYMENT_AUTHORIZATION_FAILED,
    'Payment authorization was declined.',
    409,
  );
}

export function paymentProviderError(): AppError {
  return new AppError(
    ErrorCode.PAYMENT_PROVIDER_ERROR,
    'The payment provider could not complete authorization.',
    502,
  );
}

export function paymentAlreadyAuthorized(): AppError {
  return new AppError(
    ErrorCode.PAYMENT_ALREADY_AUTHORIZED,
    'Payment for this booking is already authorized.',
    409,
  );
}

export function paymentNotFound(): AppError {
  return new AppError(ErrorCode.PAYMENT_NOT_FOUND, 'Payment has not been initiated for this booking yet.', 404);
}

export function paymentStateUnavailable(): AppError {
  return new AppError(
    ErrorCode.PAYMENT_STATE_UNAVAILABLE,
    'We could not load payment information right now.',
    502,
  );
}

export function paymentTimelineUnavailable(): AppError {
  return new AppError(
    ErrorCode.PAYMENT_TIMELINE_UNAVAILABLE,
    'We could not load payment information right now.',
    502,
  );
}

export function bookingNotConfirmed(): AppError {
  return new AppError(
    ErrorCode.BOOKING_NOT_CONFIRMED,
    'This booking is not ready to start yet.',
    409,
  );
}

export function taskAlreadyStarted(): AppError {
  return new AppError(ErrorCode.TASK_ALREADY_STARTED, 'This task has already been started.', 409);
}

export function paymentNotAuthorized(): AppError {
  return new AppError(
    ErrorCode.PAYMENT_NOT_AUTHORIZED,
    'This task cannot be started until payment authorization is complete.',
    409,
  );
}

export function invalidStateTransition(): AppError {
  return new AppError(
    ErrorCode.INVALID_STATE_TRANSITION,
    'This booking cannot change to that status.',
    409,
  );
}

export function taskCancelled(): AppError {
  return new AppError(ErrorCode.TASK_CANCELLED, 'This booking was cancelled.', 409);
}

export function taskNotInProgress(): AppError {
  return new AppError(
    ErrorCode.TASK_NOT_IN_PROGRESS,
    'This task is not currently in progress.',
    409,
  );
}

export function taskNotStarted(): AppError {
  return new AppError(ErrorCode.TASK_NOT_STARTED, 'This task has not been started.', 409);
}

export function taskAlreadySubmitted(): AppError {
  return new AppError(
    ErrorCode.TASK_ALREADY_SUBMITTED,
    'This task has already been submitted for confirmation.',
    409,
  );
}

export function taskNotAwaitingSignoff(): AppError {
  return new AppError(
    ErrorCode.TASK_NOT_AWAITING_SIGNOFF,
    'This task is not waiting for confirmation.',
    409,
  );
}

export function taskAlreadyCompleted(): AppError {
  return new AppError(ErrorCode.TASK_ALREADY_COMPLETED, 'This task has already been completed.', 409);
}

export function taskNotSubmitted(): AppError {
  return new AppError(
    ErrorCode.TASK_NOT_SUBMITTED,
    'The Student has not submitted this task for confirmation yet.',
    409,
  );
}

export function forbidden(): AppError {
  return new AppError(ErrorCode.FORBIDDEN, 'You do not have access to this resource.', 403);
}

