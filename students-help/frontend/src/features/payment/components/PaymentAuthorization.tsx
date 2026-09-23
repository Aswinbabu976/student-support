import { formatMoneyMinor } from '../../pricing/format';
import { useCostEstimate } from '../../pricing/hooks/useCostEstimate';
import { usePaymentAuthorization } from '../hooks/usePaymentAuthorization';

type PaymentAuthorizationProps = {
  bookingId: string;
  taskId: string;
};

export function PaymentAuthorization({ bookingId, taskId }: PaymentAuthorizationProps) {
  const { payment, loading, submitting, error, authorize } = usePaymentAuthorization(bookingId, true);
  const estimate = useCostEstimate(taskId);
  const displayAmountMinor = payment?.amountMinor ?? estimate.estimate?.total.amountMinor;
  const displayCurrency = payment?.currency ?? estimate.estimate?.currency;
  const authorized = payment?.status === 'AUTHORIZED';
  const failed = payment?.status === 'FAILED';
  const requiresMethod = payment?.status === 'REQUIRES_PAYMENT_METHOD';

  return (
    <section className="payment-authorization" aria-labelledby="payment-authorization-heading">
      <h2 id="payment-authorization-heading">Payment</h2>
      {displayAmountMinor !== undefined && displayCurrency ? (
        <p className="payment-authorization__total">
          Estimated total {formatMoneyMinor(displayAmountMinor, displayCurrency)}
        </p>
      ) : null}
      {loading ? <p className="section-copy">Loading payment…</p> : null}
      {error ? (
        <p className="alert alert--error" role="alert">
          {error}
        </p>
      ) : null}
      {authorized ? (
        <p className="alert alert--ok" role="status">
          {payment?.provider === 'MOCK'
            ? 'Payment authorized in the test environment. No funds were reserved at a payment network.'
            : 'Payment authorized. Funds are reserved and will be captured after the task is completed.'}
        </p>
      ) : null}
      {failed ? (
        <p className="alert alert--error" role="alert">
          Payment authorization failed
        </p>
      ) : null}
      {requiresMethod ? (
        <p className="section-copy">A payment method is required before this booking can be authorized.</p>
      ) : null}
      {!authorized && !loading ? (
        <>
          <p className="section-copy">
            Payment authorization is required before this booking can be confirmed.
          </p>
          <button
            type="button"
            className="button"
            onClick={() => {
              void authorize();
            }}
            disabled={submitting}
          >
            {submitting ? 'Preparing payment...' : 'Continue to Payment'}
          </button>
        </>
      ) : null}
    </section>
  );
}
