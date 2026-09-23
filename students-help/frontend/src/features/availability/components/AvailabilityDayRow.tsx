import { DAY_LABELS, type DayOfWeek, type WeeklyDayState } from '../types';
import { TimeSlotEditor } from './TimeSlotEditor';

type AvailabilityDayRowProps = {
  day: DayOfWeek;
  state: WeeklyDayState;
  dayError?: string;
  slotErrors: Record<string, string>;
  onToggle: (enabled: boolean) => void;
  onAddSlot: () => void;
  onChangeSlot: (index: number, patch: { start?: string; end?: string }) => void;
  onRemoveSlot: (index: number) => void;
};

export function AvailabilityDayRow({
  day,
  state,
  dayError,
  slotErrors,
  onToggle,
  onAddSlot,
  onChangeSlot,
  onRemoveSlot,
}: AvailabilityDayRowProps) {
  const toggleId = `${day}-available`;
  const errorId = dayError ? `${day}-error` : undefined;

  return (
    <section className="day-row" aria-labelledby={`${day}-heading`}>
      <div className="day-row__header">
        <h3 id={`${day}-heading`}>{DAY_LABELS[day]}</h3>
        <label className="day-toggle" htmlFor={toggleId}>
          <input
            id={toggleId}
            type="checkbox"
            checked={state.enabled}
            aria-label={`${DAY_LABELS[day]}, ${state.enabled ? 'available' : 'not available'}`}
            aria-describedby={errorId}
            onChange={(event) => onToggle(event.target.checked)}
          />
          {state.enabled ? 'Available' : 'Not available'}
        </label>
      </div>
      {state.enabled ? (
        <div className="day-row__slots">
          {state.slots.map((slot, index) => (
            <TimeSlotEditor
              key={`${day}-${index}`}
              dayLabel={DAY_LABELS[day]}
              index={index}
              start={slot.start}
              end={slot.end}
              startError={slotErrors[`${day}-${index}-start`]}
              endError={slotErrors[`${day}-${index}-end`]}
              canRemove
              onChange={(patch) => onChangeSlot(index, patch)}
              onRemove={() => onRemoveSlot(index)}
            />
          ))}
          <button className="button button--quiet" type="button" onClick={onAddSlot}>
            Add another slot
          </button>
        </div>
      ) : null}
      {dayError ? (
        <p className="field__error" id={errorId} role="alert">
          {dayError}
        </p>
      ) : null}
    </section>
  );
}
