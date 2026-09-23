import { useEffect, useId, useRef, useState } from 'react';
import { TextAreaField } from '../../skills/components/TextAreaField';
import { formatBookingTimeRange, formatTaskDateLabel } from '../format';
import { rejectionReasonError, REJECTION_REASON_MAX_LENGTH, REJECTION_REASON_MIN_LENGTH, type BookingView } from '../types';

type RejectBookingDialogProps = {
  booking: BookingView;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
};

export function RejectBookingDialog({ booking, busy, onCancel, onConfirm }: RejectBookingDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [reason, setReason] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) {
      return;
    }
    if (typeof node.showModal === 'function' && !node.open) {
      node.showModal();
    } else {
      node.setAttribute('open', '');
    }
    reasonRef.current?.focus();

    function handleCancel(event: Event) {
      event.preventDefault();
      if (!busy) {
        onCancel();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') {
        return;
      }
      event.preventDefault();
      if (!busy) {
        onCancel();
      }
    }

    node.addEventListener('cancel', handleCancel);
    node.addEventListener('keydown', handleKeyDown);
    return () => {
      node.removeEventListener('cancel', handleCancel);
      node.removeEventListener('keydown', handleKeyDown);
    };
  }, [busy, onCancel]);

  function submit(): void {
    if (busy) {
      return;
    }
    const error = rejectionReasonError(reason);
    if (error) {
      setFieldError(error);
      reasonRef.current?.focus();
      return;
    }
    setFieldError(null);
    onConfirm(reason.trim());
  }

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <h2 id={titleId}>Reject this booking?</h2>
      <p id={descriptionId}>
        {booking.task.title}
        <br />
        {formatTaskDateLabel(booking.task.preferredDate)} ·{' '}
        {formatBookingTimeRange(booking.task.preferredTime, booking.task.estimatedDurationMinutes)}
        <br />
        A short reason is required. The Help Seeker can then request another Student.
      </p>
      <form
        className="confirm-dialog__form"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <TextAreaField
          ref={reasonRef}
          id="rejection-reason"
          label="Reason"
          name="reason"
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            if (fieldError) {
              setFieldError(null);
            }
          }}
          error={fieldError ?? undefined}
          hint={`${REJECTION_REASON_MIN_LENGTH} to ${REJECTION_REASON_MAX_LENGTH} characters.`}
          maxLength={REJECTION_REASON_MAX_LENGTH}
          disabled={busy}
        />
        <div className="form-actions">
          <button className="button button--quiet" type="button" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button className="button button--danger" type="submit" disabled={busy}>
            {busy ? 'Rejecting…' : 'Reject Booking'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
