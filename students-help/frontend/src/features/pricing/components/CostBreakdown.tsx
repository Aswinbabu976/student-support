import { formatDuration } from '../../tasks/format';
import { formatMoneyMinor } from '../format';
import type { CostEstimate } from '../types';

type CostBreakdownProps = {
  estimate: CostEstimate;
};

export function CostBreakdown({ estimate }: CostBreakdownProps) {
  return (
    <dl className="cost-estimate__breakdown">
      <div>
        <dt>Estimated duration</dt>
        <dd>{formatDuration(estimate.estimatedDurationMinutes)}</dd>
      </div>
      <div>
        <dt>Base hourly rate</dt>
        <dd>{formatMoneyMinor(estimate.baseHourlyRate.amountMinor, estimate.currency)}</dd>
      </div>
      <div>
        <dt>Service subtotal</dt>
        <dd>{formatMoneyMinor(estimate.subtotal.amountMinor, estimate.currency)}</dd>
      </div>
      <div>
        <dt>Platform fee</dt>
        <dd>{formatMoneyMinor(estimate.platformFee.amountMinor, estimate.currency)}</dd>
      </div>
      <div>
        <dt>Estimated total</dt>
        <dd>{formatMoneyMinor(estimate.total.amountMinor, estimate.currency)}</dd>
      </div>
    </dl>
  );
}
