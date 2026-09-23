import { Link, useParams } from 'react-router-dom';
import { AuthShell } from '../../features/auth/components/AuthShell';
import { BookingProgressTracker } from '../../features/booking/components/BookingProgressTracker';
import { ConfirmCompletionDialog } from '../../features/booking/components/ConfirmCompletionDialog';
import { formatStartedClock, formatTaskDateLabel } from '../../features/booking/format';
import { useBooking } from '../../features/booking/hooks/useBooking';
import { headingForBookingStatus, resolveBookingProgress } from '../../features/booking/progress';
import { HelpSeekerAccountNav } from '../../features/help-seeker/HelpSeekerAccountNav';
import { CostEstimate } from '../../features/pricing/components/CostEstimate';
import { PaymentAuthorization } from '../../features/payment/components/PaymentAuthorization';
import { formatDuration } from '../../features/tasks/format';

export function BookingRequestStatusPage() {
  const { bookingId } = useParams();
  const page = useBooking(bookingId);
  const booking = page.booking;
  const progress = booking ? resolveBookingProgress(booking, 'HELP_SEEKER') : null;
  const showExecutionTimes =
    booking?.status === 'IN_PROGRESS' ||
    booking?.status === 'AWAITING_SIGNOFF' ||
    booking?.status === 'COMPLETED';

  return (
    <AuthShell eyebrow="Help Seeker">
      <section className="account-page account-page--wide">
        <HelpSeekerAccountNav />

        {page.loading ? <p className="lede">Loading booking…</p> : null}

        {page.error ? (
          <div className="alert alert--error" role="alert">
            {page.error}
          </div>
        ) : null}

        {page.actionError ? (
          <div className="alert alert--error" role="alert">
            {page.actionError}
          </div>
        ) : null}

        {booking && progress ? (
          <section>
            <p className="eyebrow">Booking</p>
            <h1>{headingForBookingStatus(booking.status, 'HELP_SEEKER')}</h1>
            <BookingProgressTracker progress={progress} />
            {booking.status === 'AWAITING_SIGNOFF' ? (
              <p className="lede">Student has marked the task as done. Confirmation is required.</p>
            ) : null}
            {booking.status === 'COMPLETED' ? (
              <p className="lede">
                You confirmed that this task is complete. Payment release is handled by the payment
                workflow and is not the same as this confirmation.
              </p>
            ) : null}
            <dl className="review-list">
              <div>
                <dt>Status</dt>
                <dd>
                  <span className="booking-status">{booking.status}</span>
                </dd>
              </div>
              <div>
                <dt>Student</dt>
                <dd>
                  {booking.student.verificationStatus === 'VERIFIED' ? 'Verified student' : 'Student'}
                </dd>
              </div>
              <div>
                <dt>Task</dt>
                <dd>{booking.task.title}</dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>{formatTaskDateLabel(booking.task.preferredDate)}</dd>
              </div>
              <div>
                <dt>Time</dt>
                <dd>
                  {booking.task.preferredTime} ({booking.task.timezone})
                </dd>
              </div>
              <div>
                <dt>Estimated duration</dt>
                <dd>{formatDuration(booking.task.estimatedDurationMinutes)}</dd>
              </div>
              {showExecutionTimes && booking.startedAt ? (
                <div>
                  <dt>Started at</dt>
                  <dd>
                    <time dateTime={booking.startedAt}>
                      {formatStartedClock(booking.startedAt, booking.task.timezone)}
                    </time>
                  </dd>
                </div>
              ) : null}
              {(booking.status === 'AWAITING_SIGNOFF' || booking.status === 'COMPLETED') &&
              booking.submittedForSignoffAt ? (
                <div>
                  <dt>Submitted for confirmation</dt>
                  <dd>
                    <time dateTime={booking.submittedForSignoffAt}>
                      {formatStartedClock(booking.submittedForSignoffAt, booking.task.timezone)}
                    </time>
                  </dd>
                </div>
              ) : null}
              {booking.status === 'COMPLETED' && booking.completedAt ? (
                <div>
                  <dt>Confirmed at</dt>
                  <dd>
                    <time dateTime={booking.completedAt}>
                      {formatStartedClock(booking.completedAt, booking.task.timezone)}
                    </time>
                  </dd>
                </div>
              ) : null}
              {booking.status === 'REJECTED' && booking.rejectionReason ? (
                <div>
                  <dt>Rejection reason</dt>
                  <dd>{booking.rejectionReason}</dd>
                </div>
              ) : null}
            </dl>
            <CostEstimate taskId={booking.task.id} />
            {booking.status === 'ACCEPTED' ? (
              <PaymentAuthorization bookingId={booking.id} taskId={booking.task.id} />
            ) : null}
            <div className="form-actions">
              {page.canConfirmCompletion ? (
                <button
                  type="button"
                  className="button"
                  onClick={page.openConfirmCompletion}
                  disabled={page.submitting}
                >
                  Confirm Completion
                </button>
              ) : null}
              <Link className="button" to={`/help-seeker/tasks/${booking.task.id}`}>
                Back to Task
              </Link>
              <Link className="button button--quiet" to={`/help-seeker/tasks/${booking.task.id}/recommendations`}>
                Back to Students
              </Link>
            </div>
            {page.confirmingCompletion && page.canConfirmCompletion ? (
              <ConfirmCompletionDialog
                booking={booking}
                busy={page.submitting}
                onCancel={page.closeDialog}
                onConfirm={() => {
                  void page.submitConfirmation();
                }}
              />
            ) : null}
          </section>
        ) : null}
      </section>
    </AuthShell>
  );
}
