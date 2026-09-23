import { SelectField } from '../../auth/components/SelectField';
import { DAYS_OF_WEEK, type DayOfWeek, type WeeklyDayState } from '../types';
import type { WeeklyFieldErrors } from '../schemas/availability';
import { AvailabilityDayRow } from './AvailabilityDayRow';

type WeeklyAvailabilityProps = {
  timezone: string;
  timezoneOptions: string[];
  days: Record<DayOfWeek, WeeklyDayState>;
  errors: WeeklyFieldErrors;
  formError: string | null;
  submitting: boolean;
  onTimezoneChange: (value: string) => void;
  onToggle: (day: DayOfWeek, enabled: boolean) => void;
  onAddSlot: (day: DayOfWeek) => void;
  onChangeSlot: (day: DayOfWeek, index: number, patch: { start?: string; end?: string }) => void;
  onRemoveSlot: (day: DayOfWeek, index: number) => void;
  onSubmit: () => void;
};

export function WeeklyAvailability({
  timezone,
  timezoneOptions,
  days,
  errors,
  formError,
  submitting,
  onTimezoneChange,
  onToggle,
  onAddSlot,
  onChangeSlot,
  onRemoveSlot,
  onSubmit,
}: WeeklyAvailabilityProps) {
  return (
    <section className="availability-section" aria-labelledby="weekly-availability-heading">
      <h2 id="weekly-availability-heading">Weekly availability</h2>
      <p className="section-copy">Times are saved in your selected timezone and repeat every week.</p>
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
        <SelectField
          id="availability-timezone"
          label="Timezone"
          name="timezone"
          value={timezone}
          error={errors.timezone}
          onChange={(event) => onTimezoneChange(event.target.value)}
        >
          <option value="">Select a timezone</option>
          {timezoneOptions.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </SelectField>
        <div className="week-list">
          {DAYS_OF_WEEK.map((day) => (
            <AvailabilityDayRow
              key={day}
              day={day}
              state={days[day]}
              dayError={errors.days?.[day]}
              slotErrors={errors.slots ?? {}}
              onToggle={(enabled) => onToggle(day, enabled)}
              onAddSlot={() => onAddSlot(day)}
              onChangeSlot={(index, patch) => onChangeSlot(day, index, patch)}
              onRemoveSlot={(index) => onRemoveSlot(day, index)}
            />
          ))}
        </div>
        <div className="form-actions">
          <button className="button" type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save weekly availability'}
          </button>
        </div>
      </form>
    </section>
  );
}
