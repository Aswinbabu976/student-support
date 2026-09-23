import type { PaymentTimelineHeadline } from '../types';

const HEADLINE_TITLE: Record<PaymentTimelineHeadline, string> = {
  PAYMENT_PENDING: 'Payment pending',
  PAYMENT_RESERVED: 'Payment reserved',
  PAYMENT_FAILED: 'Payment authorization failed',
  AWAITING_CONFIRMATION: 'Payment reserved',
  AWAITING_PAYOUT: 'Payment reserved',
  PAYMENT_RELEASED: 'Payment released',
};

type PaymentStatusMessageProps = {
  headline: PaymentTimelineHeadline;
  summary: string;
};

export function PaymentStatusMessage({ headline, summary }: PaymentStatusMessageProps) {
  const tone =
    headline === 'PAYMENT_FAILED' ? 'error' : headline === 'PAYMENT_RELEASED' ? 'ok' : 'plain';

  return (
    <div
      className={tone === 'plain' ? 'section-copy' : `alert alert--${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <p className="payment-timeline__status">{HEADLINE_TITLE[headline]}</p>
      <p>{summary}</p>
    </div>
  );
}
