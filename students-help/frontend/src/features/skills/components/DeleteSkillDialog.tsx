import { useEffect, useId, useRef } from 'react';

type DeleteSkillDialogProps = {
  skillName: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteSkillDialog({ skillName, busy, onCancel, onConfirm }: DeleteSkillDialogProps) {
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

    node.addEventListener('cancel', handleCancel);
    return () => {
      node.removeEventListener('cancel', handleCancel);
    };
  }, [busy, onCancel]);

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <h2 id={titleId}>Remove &quot;{skillName}&quot;?</h2>
      <p id={descriptionId}>
        This skill will no longer appear on your Student profile and may affect future matching.
      </p>
      <div className="form-actions">
        <button ref={cancelRef} className="button button--quiet" type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button className="button button--danger" type="button" onClick={onConfirm} disabled={busy}>
          {busy ? 'Removing…' : 'Remove Skill'}
        </button>
      </div>
    </dialog>
  );
}
