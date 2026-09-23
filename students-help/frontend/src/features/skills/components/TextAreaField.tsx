import { forwardRef, type TextareaHTMLAttributes } from 'react';

type TextAreaFieldProps = {
  id: string;
  label: string;
  error?: string;
  hint?: string;
} & TextareaHTMLAttributes<HTMLTextAreaElement>;

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(
  function TextAreaField({ id, label, error, hint, ...textareaProps }, ref) {
    const hintId = hint ? `${id}-hint` : undefined;
    const errorId = error ? `${id}-error` : undefined;
    const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

    return (
      <div className="field">
        <label className="field__label" htmlFor={id}>
          {label}
        </label>
        {hint ? (
          <p className="field__hint" id={hintId}>
            {hint}
          </p>
        ) : null}
        <textarea
          {...textareaProps}
          ref={ref}
          className="field__control field__control--area"
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
        />
        {error ? (
          <p className="field__error" id={errorId} role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);
