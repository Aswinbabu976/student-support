import type { PaymentTimelineStep } from '../types';
import { PaymentTimelineStepItem } from './PaymentTimelineStep';

type PaymentTimelineProps = {
  steps: PaymentTimelineStep[];
};

export function PaymentTimeline({ steps }: PaymentTimelineProps) {
  return (
    <ol className="progress-tracker__list payment-timeline__list">
      {steps.map((step, index) => (
        <PaymentTimelineStepItem key={step.key} step={step} index={index} total={steps.length} />
      ))}
    </ol>
  );
}
