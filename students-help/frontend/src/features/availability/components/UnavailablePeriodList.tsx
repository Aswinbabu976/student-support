import { formatUnavailableRange } from '../format';
import type { UnavailablePeriodView } from '../types';

type UnavailablePeriodListProps = {
  periods: UnavailablePeriodView[];
  onRemove: (period: UnavailablePeriodView) => void;
};

export function UnavailablePeriodList({ periods, onRemove }: UnavailablePeriodListProps) {
  if (periods.length === 0) {
    return <p className="section-copy">No unavailable dates yet.</p>;
  }

  return (
    <ul className="unavailable-list">
      {periods.map((period) => (
        <li key={period.id} className="unavailable-row">
          <div>
            <p className="unavailable-row__dates">{formatUnavailableRange(period.startDate, period.endDate)}</p>
            {period.reason ? <p className="unavailable-row__reason">{period.reason}</p> : null}
          </div>
          <button className="button button--quiet" type="button" onClick={() => onRemove(period)}>
            Remove
          </button>
        </li>
      ))}
    </ul>
  );
}
