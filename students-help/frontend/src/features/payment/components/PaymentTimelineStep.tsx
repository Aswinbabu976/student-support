import { formatOccurredAt } from '../../booking/format';
import type { PaymentTimelineStep, PaymentTimelineStepStatus } from '../types';

const STEP_CLASS: Record<PaymentTimelineStepStatus, string> = {
  COMPLETED: 'complete',
  CURRENT: 'current',
  UPCOMING: 'upcoming',
  FAILED: 'declined',
};

const MARKERS: Record<PaymentTimelineStepStatus, string> = {
  COMPLETED: '✓',
  CURRENT: '●',
  UPCOMING: '○',
  FAILED: '✕',
};

const STATUS_LABELS: Record<PaymentTimelineStepStatus, string> = {
  COMPLETED: 'completed',
  CURRENT: 'current',
  UPCOMING: 'upcoming',
  FAILED: 'failed',
};

type PaymentTimelineStepItemProps = {
  step: PaymentTimelineStep;
  index: number;
  total: number;
};

export function PaymentTimelineStepItem({ step, index, total }: PaymentTimelineStepItemProps) {
  const when = step.completedAt ? formatOccurredAt(step.completedAt) : null;
  const className = `progress-tracker__step progress-tracker__step--${STEP_CLASS[step.status]}`;

  return (
    <li className={className} aria-current={step.status === 'CURRENT' ? 'step' : undefined}>
      <span className="progress-tracker__marker" aria-hidden="true">
        {MARKERS[step.status]}
      </span>
      <div>
        <p className="progress-tracker__label">{step.label}</p>
        <p className="progress-tracker__meta">
          <span className="sr-only">
            Step {index + 1} of {total}, {step.label}, {STATUS_LABELS[step.status]}.
          </span>
          <span>
            {STATUS_LABELS[step.status].charAt(0).toUpperCase() + STATUS_LABELS[step.status].slice(1)}
            {when ? ` · ${when}` : ''}
          </span>
        </p>
      </div>
    </li>
  );
}
