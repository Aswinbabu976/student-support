import { useEffect, useId, useRef } from 'react';
import { formatBookingTimeRange, formatTaskDateLabel } from '../format';
import type { BookingView } from '../types';

type AcceptBookingDialogProps = {
  booking: BookingView;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function AcceptBookingDialog({ booking, busy, onCancel, onConfirm }: AcceptBookingDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

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
    cancelRef.current?.focus();

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

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <h2 id={titleId}>Accept this booking?</h2>
      <p id={descriptionId}>
        {booking.task.title}
        <br />
        {formatTaskDateLabel(booking.task.preferredDate)} ·{' '}
        {formatBookingTimeRange(booking.task.preferredTime, booking.task.estimatedDurationMinutes)}
        <br />
        By accepting, this task will be added to your workload.
      </p>
      <div className="form-actions">
        <button ref={cancelRef} className="button button--quiet" type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button className="button" type="button" onClick={onConfirm} disabled={busy}>
          {busy ? 'Accepting…' : 'Accept Booking'}
        </button>
      </div>
    </dialog>
  );
}
