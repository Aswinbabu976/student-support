import { useCostEstimate } from '../hooks/useCostEstimate';
import { formatMoneyMinor } from '../format';
import { CostBreakdown } from './CostBreakdown';

type CostEstimateProps = {
  taskId: string | undefined;
};

export function CostEstimate({ taskId }: CostEstimateProps) {
  const { estimate, loading, error } = useCostEstimate(taskId);

  return (
    <section className="cost-estimate" aria-labelledby="cost-estimate-heading">
      <h2 id="cost-estimate-heading">Estimated Cost</h2>
      {loading ? <p className="section-copy">Loading estimate…</p> : null}
      {error ? (
        <p className="alert alert--error" role="alert">
          {error}
        </p>
      ) : null}
      {estimate ? (
        <>
          <p className="cost-estimate__total">{formatMoneyMinor(estimate.total.amountMinor, estimate.currency)}</p>
          <h3>Breakdown</h3>
          <CostBreakdown estimate={estimate} />
          <p className="section-copy">
            This is an estimate based on the task duration and current platform pricing.
          </p>
        </>
      ) : null}
    </section>
  );
}
