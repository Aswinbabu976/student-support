import { useParams } from 'react-router-dom';
import { AuthShell } from '../../features/auth/components/AuthShell';
import { AcceptBookingDialog } from '../../features/booking/components/AcceptBookingDialog';
import { BookingProgressTracker } from '../../features/booking/components/BookingProgressTracker';
import { MarkDoneDialog } from '../../features/booking/components/MarkDoneDialog';
import { RejectBookingDialog } from '../../features/booking/components/RejectBookingDialog';
import { StartTaskDialog } from '../../features/booking/components/StartTaskDialog';
import {
  formatBookingTimeRange,
  formatStartedClock,
  formatTaskDateLabel,
} from '../../features/booking/format';
import { useStudentBookingRequest } from '../../features/booking/hooks/useStudentBookingRequest';
import { headingForBookingStatus, resolveBookingProgress } from '../../features/booking/progress';
import { StudentAccountNav } from '../../features/student/StudentAccountNav';
import { StudentPaymentSummary } from '../../features/payment/components/StudentPaymentSummary';
import { formatDuration } from '../../features/tasks/format';

function taskStatusLabel(status: string): string {
  if (status === 'CONFIRMED') {
    return 'Ready to start';
  }
  if (status === 'IN_PROGRESS') {
    return 'In progress';
  }
  if (status === 'AWAITING_SIGNOFF') {
    return 'Waiting for Help Seeker confirmation';
  }
  if (status === 'COMPLETED') {
    return 'Completed';
  }
  return status;
}

export function StudentBookingRequestPage() {
  const { bookingId } = useParams();
  const page = useStudentBookingRequest(bookingId);
  const booking = page.booking;
  const progress = booking ? resolveBookingProgress(booking, 'STUDENT') : null;
  const showPaymentSummary =
    booking?.status === 'ACCEPTED' ||
    booking?.status === 'CONFIRMED' ||
    booking?.status === 'IN_PROGRESS' ||
    booking?.status === 'AWAITING_SIGNOFF' ||
    booking?.status === 'COMPLETED';

  return (
    <AuthShell eyebrow="Student">
      <section className="account-page account-page--wide">
        <StudentAccountNav />

        <p className="eyebrow">Booking</p>
        <h1>{headingForBookingStatus(booking?.status ?? 'PENDING', 'STUDENT')}</h1>
        {page.loading ? <p className="lede">Loading booking request…</p> : null}
        {!page.loading && booking?.status === 'PENDING' ? (
          <p className="lede">Review the task details, then accept or reject this request.</p>
        ) : null}
        {!page.loading && booking?.status === 'CONFIRMED' ? (
          <p className="lede">This booking is ready to start.</p>
        ) : null}
        {!page.loading && booking?.status === 'IN_PROGRESS' ? (
          <p className="lede">This task is in progress.</p>
        ) : null}
        {!page.loading && booking?.status === 'AWAITING_SIGNOFF' ? (
          <p className="lede">
            The Help Seeker needs to confirm completion before the payment can move to the release stage.
          </p>
        ) : null}
        {!page.loading && booking?.status === 'COMPLETED' ? (
          <p className="lede">
            The Help Seeker confirmed that this task is complete. Payment release is shown in the payment
            timeline and is not automatic from this confirmation alone.
          </p>
        ) : null}

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
            <BookingProgressTracker progress={progress} />
            {booking.status === 'REJECTED' ? (
              <p className="section-copy">The Help Seeker can continue looking for another Student.</p>
            ) : null}
            <dl className="review-list">
              {booking.status === 'CONFIRMED' ||
              booking.status === 'IN_PROGRESS' ||
              booking.status === 'AWAITING_SIGNOFF' ||
              booking.status === 'COMPLETED' ? (
                <div>
                  <dt>Task status</dt>
                  <dd>
                    <span>{taskStatusLabel(booking.status)}</span>
                  </dd>
                </div>
              ) : null}
              <div>
                <dt>Current status</dt>
                <dd>
                  <span className="booking-status">{booking.status}</span>
                </dd>
              </div>
              {(booking.status === 'IN_PROGRESS' ||
                booking.status === 'AWAITING_SIGNOFF' ||
                booking.status === 'COMPLETED') &&
              booking.startedAt ? (
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
                  <dt>You marked this task as done at</dt>
                  <dd>
                    <time dateTime={booking.submittedForSignoffAt}>
                      {formatStartedClock(booking.submittedForSignoffAt, booking.task.timezone)}
                    </time>
                  </dd>
                </div>
              ) : null}
              {booking.status === 'COMPLETED' && booking.completedAt ? (
                <div>
                  <dt>Help Seeker confirmed at</dt>
                  <dd>
                    <time dateTime={booking.completedAt}>
                      {formatStartedClock(booking.completedAt, booking.task.timezone)}
                    </time>
                  </dd>
                </div>
              ) : null}
              <div>
                <dt>Task</dt>
                <dd>{booking.task.title}</dd>
              </div>
              <div>
                <dt>Description</dt>
                <dd>{booking.task.description}</dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>{formatTaskDateLabel(booking.task.preferredDate)}</dd>
              </div>
              <div>
                <dt>Time</dt>
                <dd>
                  {formatBookingTimeRange(booking.task.preferredTime, booking.task.estimatedDurationMinutes)}{' '}
                  ({booking.task.timezone})
                </dd>
              </div>
              <div>
                <dt>Estimated duration</dt>
                <dd>{formatDuration(booking.task.estimatedDurationMinutes)}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{booking.task.location.addressLine}</dd>
              </div>
              <div>
                <dt>Required skills</dt>
                <dd>{booking.task.skills.map((skill) => skill.name).join(', ')}</dd>
              </div>
              <div>
                <dt>Special instructions</dt>
                <dd>{booking.task.specialInstructions || 'None'}</dd>
              </div>
              {booking.status === 'REJECTED' && booking.rejectionReason ? (
                <div>
                  <dt>Rejection reason</dt>
                  <dd>{booking.rejectionReason}</dd>
                </div>
              ) : null}
            </dl>

            {showPaymentSummary ? (
              <StudentPaymentSummary
                bookingId={booking.id}
                revision={`${booking.status}:${booking.startedAt ?? ''}:${booking.submittedForSignoffAt ?? ''}:${booking.completedAt ?? ''}`}
              />
            ) : null}

            {page.canAccept || page.canReject || page.canStart || page.canComplete ? (
              <div className="form-actions">
                {page.canReject ? (
                  <button
                    type="button"
                    className="button button--quiet"
                    onClick={page.openReject}
                    disabled={page.submitting}
                  >
                    Reject Booking
                  </button>
                ) : null}
                {page.canAccept ? (
                  <button type="button" className="button" onClick={page.openAccept} disabled={page.submitting}>
                    Accept Booking
                  </button>
                ) : null}
                {page.canStart ? (
                  <button type="button" className="button" onClick={page.openStart} disabled={page.submitting}>
                    Start Task
                  </button>
                ) : null}
                {page.canComplete ? (
                  <button type="button" className="button" onClick={page.openDone} disabled={page.submitting}>
                    Mark as Done
                  </button>
                ) : null}
              </div>
            ) : null}

            {page.confirmingAccept && page.canAccept ? (
              <AcceptBookingDialog
                booking={booking}
                busy={page.submitting}
                onCancel={page.closeDialog}
                onConfirm={() => {
                  void page.confirmAccept();
                }}
              />
            ) : null}

            {page.confirmingReject && page.canReject ? (
              <RejectBookingDialog
                booking={booking}
                busy={page.submitting}
                onCancel={page.closeDialog}
                onConfirm={(reason) => {
                  void page.confirmReject(reason);
                }}
              />
            ) : null}

            {page.confirmingStart && page.canStart ? (
              <StartTaskDialog
                booking={booking}
                busy={page.submitting}
                onCancel={page.closeDialog}
                onConfirm={() => {
                  void page.confirmStart();
                }}
              />
            ) : null}

            {page.confirmingDone && page.canComplete ? (
              <MarkDoneDialog
                booking={booking}
                busy={page.submitting}
                onCancel={page.closeDialog}
                onConfirm={() => {
                  void page.confirmDone();
                }}
              />
            ) : null}
          </section>
        ) : null}
      </section>
    </AuthShell>
  );
}
