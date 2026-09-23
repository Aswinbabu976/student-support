import { TextField } from '../../auth/components/TextField';
import type { TaskFormErrors } from '../schemas/create-task';
import type { TaskFormValues } from '../types';

type TaskLocationSectionProps = {
  values: TaskFormValues;
  errors: TaskFormErrors;
  savedAddress: string | null;
  onChange: (patch: Partial<TaskFormValues>) => void;
};

export function TaskLocationSection({
  values,
  errors,
  savedAddress,
  onChange,
}: TaskLocationSectionProps) {
  return (
    <fieldset className="form-section">
      <legend>Location</legend>
      <p className="section-copy">
        Students need a street address to understand where the work happens. Later edits to your
        saved address will not change this task.
      </p>
      {savedAddress ? (
        <label className="day-toggle">
          <input
            type="checkbox"
            checked={values.useSavedAddress}
            onChange={(event) => {
              const useSavedAddress = event.target.checked;
              onChange({
                useSavedAddress,
                locationLine: useSavedAddress ? savedAddress : values.locationLine,
              });
            }}
          />
          Use saved address
        </label>
      ) : null}
      <TextField
        id="task-location"
        label="Task location"
        name="location"
        autoComplete="street-address"
        value={values.locationLine}
        error={errors.locationLine}
        hint={savedAddress ? `Saved address: ${savedAddress}` : 'Include street, city, and postal details.'}
        onChange={(event) =>
          onChange({
            locationLine: event.target.value,
            useSavedAddress: savedAddress ? event.target.value.trim() === savedAddress : false,
          })
        }
      />
    </fieldset>
  );
}
