import { formatOccurredAt } from '../format';
import type { BookingProgress } from '../types';

const MARKERS: Record<string, string> = {
  complete: '✓',
  current: '●',
  upcoming: '○',
  declined: '✕',
};

const STATE_LABELS: Record<string, string> = {
  complete: 'Completed',
  current: 'Current step',
  upcoming: 'Upcoming',
  declined: 'Declined',
};

type BookingProgressTrackerProps = {
  progress: BookingProgress;
};

export function BookingProgressTracker({ progress }: BookingProgressTrackerProps) {
  return (
    <section className="progress-tracker" aria-labelledby="booking-progress-heading">
      <h2 id="booking-progress-heading">Booking Status</h2>
      <p className="section-copy">{progress.summary}</p>
      <ol className="progress-tracker__list">
        {progress.steps.map((step) => {
          const when = step.occurredAt ? formatOccurredAt(step.occurredAt) : null;
          const meta = step.state === 'current' ? 'Current step' : when;
          return (
            <li
              key={step.id}
              className={`progress-tracker__step progress-tracker__step--${step.state}`}
              aria-current={step.state === 'current' ? 'step' : undefined}
            >
              <span className="progress-tracker__marker" aria-hidden="true">
                {MARKERS[step.state]}
              </span>
              <div>
                <p className="progress-tracker__label">{step.label}</p>
                <p className="progress-tracker__meta">
                  <span className="sr-only">{STATE_LABELS[step.state]}. </span>
                  {meta}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
