import { formatMoneyMinor } from '../../pricing/format';
import { usePaymentTimeline } from '../hooks/usePaymentTimeline';
import { PaymentStatusMessage } from './PaymentStatusMessage';
import { PaymentTimeline } from './PaymentTimeline';

type StudentPaymentSummaryProps = {
  bookingId: string;
  revision?: string;
};

export function StudentPaymentSummary({ bookingId, revision }: StudentPaymentSummaryProps) {
  const { timeline, loading, error } = usePaymentTimeline(bookingId, true, revision);

  return (
    <section className="payment-timeline" aria-labelledby="student-payment-heading">
      <h2 id="student-payment-heading">Payment</h2>
      {loading ? <p className="section-copy">Loading payment…</p> : null}
      {error ? (
        <p className="alert alert--error" role="alert">
          {error}
        </p>
      ) : null}
      {timeline ? (
        <>
          <p className="payment-timeline__earnings-label">Expected earnings</p>
          <p className="payment-authorization__total">
            {formatMoneyMinor(timeline.estimatedEarnings.amountMinor, timeline.currency)}
          </p>
          <h3>Breakdown</h3>
          <dl className="cost-estimate__breakdown">
            <div>
              <dt>Task amount</dt>
              <dd>{formatMoneyMinor(timeline.taskAmount.amountMinor, timeline.currency)}</dd>
            </div>
            <div>
              <dt>Platform fee</dt>
              <dd>{formatMoneyMinor(timeline.platformFee.amountMinor, timeline.currency)}</dd>
            </div>
            <div>
              <dt>Your earnings</dt>
              <dd>{formatMoneyMinor(timeline.estimatedEarnings.amountMinor, timeline.currency)}</dd>
            </div>
          </dl>
          <PaymentStatusMessage headline={timeline.headline} summary={timeline.summary} />
          <h3>Timeline</h3>
          <PaymentTimeline steps={timeline.timeline} />
        </>
      ) : null}
    </section>
  );
}
