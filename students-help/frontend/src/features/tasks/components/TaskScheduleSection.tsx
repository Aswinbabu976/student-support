import { SelectField } from '../../auth/components/SelectField';
import { TextField } from '../../auth/components/TextField';
import type { TaskFormErrors } from '../schemas/create-task';
import type { TaskFormValues } from '../types';

type TaskScheduleSectionProps = {
  values: TaskFormValues;
  errors: TaskFormErrors;
  timezones: string[];
  onChange: (patch: Partial<TaskFormValues>) => void;
};

export function TaskScheduleSection({
  values,
  errors,
  timezones,
  onChange,
}: TaskScheduleSectionProps) {
  const durationErrorId = errors.estimatedDurationMinutes ? 'task-duration-error' : undefined;
  const durationHintId = 'task-duration-hint';

  return (
    <fieldset className="form-section">
      <legend>Date and time</legend>
      <p className="section-copy">
        Choose when you want the work to start and how long you expect it to take. Times use the
        timezone you select, not the server clock.
      </p>
      <div className="date-row">
        <TextField
          id="task-date"
          label="Preferred date"
          name="preferredDate"
          type="date"
          value={values.preferredDate}
          error={errors.preferredDate}
          onChange={(event) => onChange({ preferredDate: event.target.value })}
        />
        <TextField
          id="task-time"
          label="Preferred time"
          name="preferredTime"
          type="time"
          value={values.preferredTime}
          error={errors.preferredTime}
          onChange={(event) => onChange({ preferredTime: event.target.value })}
        />
      </div>
      <SelectField
        id="task-timezone"
        label="Timezone"
        name="timezone"
        value={values.timezone}
        error={errors.timezone}
        onChange={(event) => onChange({ timezone: event.target.value })}
      >
        {timezones.map((zone) => (
          <option key={zone} value={zone}>
            {zone}
          </option>
        ))}
      </SelectField>
      <div className="field" aria-describedby={[durationHintId, durationErrorId].filter(Boolean).join(' ') || undefined}>
        <p className="field__label" id="task-duration-label">
          Estimated duration
        </p>
        <p className="field__hint" id={durationHintId}>
          Enter hours and minutes. For example 3 hours.
        </p>
        <div className="duration-row" role="group" aria-labelledby="task-duration-label">
          <TextField
            id="task-duration-hours"
            label="Hours"
            name="durationHours"
            inputMode="numeric"
            min={0}
            max={24}
            value={values.durationHours}
            onChange={(event) => onChange({ durationHours: event.target.value })}
          />
          <TextField
            id="task-duration-minutes"
            label="Minutes"
            name="durationMinutes"
            inputMode="numeric"
            min={0}
            max={59}
            value={values.durationMinutes}
            onChange={(event) => onChange({ durationMinutes: event.target.value })}
          />
        </div>
        {errors.estimatedDurationMinutes ? (
          <p className="field__error" id={durationErrorId} role="alert">
            {errors.estimatedDurationMinutes}
          </p>
        ) : null}
      </div>
    </fieldset>
  );
}
