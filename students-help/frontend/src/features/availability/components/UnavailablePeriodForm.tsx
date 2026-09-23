import { TextField } from '../../auth/components/TextField';

type UnavailablePeriodFormProps = {
  startDate: string;
  endDate: string;
  reason: string;
  errors: {
    startDate?: string;
    endDate?: string;
    reason?: string;
  };
  formError: string | null;
  submitting: boolean;
  minDate: string;
  onChange: (patch: { startDate?: string; endDate?: string; reason?: string }) => void;
  onSubmit: () => void;
};

export function UnavailablePeriodForm({
  startDate,
  endDate,
  reason,
  errors,
  formError,
  submitting,
  minDate,
  onChange,
  onSubmit,
}: UnavailablePeriodFormProps) {
  return (
    <form
      className="form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {formError ? (
        <div className="alert alert--error" role="alert">
          {formError}
        </div>
      ) : null}
      <div className="date-row">
        <TextField
          id="unavailable-start"
          label="Start date"
          type="date"
          name="startDate"
          min={minDate}
          value={startDate}
          error={errors.startDate}
          onChange={(event) => onChange({ startDate: event.target.value })}
        />
        <TextField
          id="unavailable-end"
          label="End date"
          type="date"
          name="endDate"
          min={startDate || minDate}
          value={endDate}
          error={errors.endDate}
          onChange={(event) => onChange({ endDate: event.target.value })}
        />
      </div>
      <TextField
        id="unavailable-reason"
        label="Reason (optional)"
        name="reason"
        maxLength={200}
        value={reason}
        error={errors.reason}
        hint="For example, vacation or exams."
        onChange={(event) => onChange({ reason: event.target.value })}
      />
      <div className="form-actions">
        <button className="button" type="submit" disabled={submitting}>
          {submitting ? 'Adding…' : 'Add unavailable period'}
        </button>
      </div>
    </form>
  );
}
