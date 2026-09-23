type TimeSlotEditorProps = {
  dayLabel: string;
  index: number;
  start: string;
  end: string;
  startError?: string;
  endError?: string;
  onChange: (patch: { start?: string; end?: string }) => void;
  onRemove: () => void;
  canRemove: boolean;
};

export function TimeSlotEditor({
  dayLabel,
  index,
  start,
  end,
  startError,
  endError,
  onChange,
  onRemove,
  canRemove,
}: TimeSlotEditorProps) {
  const startId = `${dayLabel}-start-${index}`;
  const endId = `${dayLabel}-end-${index}`;
  const startErrorId = startError ? `${startId}-error` : undefined;
  const endErrorId = endError ? `${endId}-error` : undefined;

  return (
    <div className="slot-row">
      <div className="slot-row__fields">
        <div className="field">
          <label className="field__label" htmlFor={startId}>
            Start
          </label>
          <input
            id={startId}
            className="field__control"
            type="time"
            name={`${dayLabel}-start-${index}`}
            value={start}
            aria-invalid={Boolean(startError)}
            aria-describedby={startErrorId}
            onChange={(event) => onChange({ start: event.target.value })}
          />
          {startError ? (
            <p className="field__error" id={startErrorId} role="alert">
              {startError}
            </p>
          ) : null}
        </div>
        <p className="slot-row__to">to</p>
        <div className="field">
          <label className="field__label" htmlFor={endId}>
            End
          </label>
          <input
            id={endId}
            className="field__control"
            type="time"
            name={`${dayLabel}-end-${index}`}
            value={end}
            aria-invalid={Boolean(endError)}
            aria-describedby={endErrorId}
            onChange={(event) => onChange({ end: event.target.value })}
          />
          {endError ? (
            <p className="field__error" id={endErrorId} role="alert">
              {endError}
            </p>
          ) : null}
        </div>
      </div>
      {canRemove ? (
        <button className="button button--quiet" type="button" onClick={onRemove}>
          Remove slot
        </button>
      ) : null}
    </div>
  );
}
