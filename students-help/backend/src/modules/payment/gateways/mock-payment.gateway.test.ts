import { beforeEach, describe, expect, it } from 'vitest';
import { PaymentGatewayError } from '../payment.errors.js';
import { MockPaymentGateway } from './mock-payment.gateway.js';

const input = {
  amountMinor: 4950,
  platformFeeMinor: 450,
  currency: 'EUR',
  bookingId: 'booking_1',
  paymentId: 'payment_1',
  idempotencyKey: 'payment-authorization:booking_1',
};

describe('MockPaymentGateway', () => {
  let gateway: MockPaymentGateway;

  beforeEach(() => {
    gateway = new MockPaymentGateway();
  });

  it('authorizes the success payment method reference', async () => {
    const result = await gateway.createAuthorization({
      ...input,
      paymentMethodRef: 'pm_test_success',
    });
    expect(result).toEqual({
      providerPaymentId: 'mock_auth_payment_1',
      status: 'AUTHORIZED',
    });
    await expect(gateway.retrieveAuthorization(result.providerPaymentId)).resolves.toEqual(result);
  });

  it('authorizes when the payment method reference is omitted', async () => {
    const result = await gateway.createAuthorization(input);
    expect(result.status).toBe('AUTHORIZED');
    expect(result.providerPaymentId).toBe('mock_auth_payment_1');
  });

  it('declines the declined payment method reference', async () => {
    const result = await gateway.createAuthorization({
      ...input,
      paymentMethodRef: 'pm_test_declined',
    });
    expect(result.status).toBe('FAILED');
    expect(result.failureCode).toBe('DECLINED');
  });

  it('throws a provider error for the error payment method reference', async () => {
    await expect(
      gateway.createAuthorization({
        ...input,
        paymentMethodRef: 'pm_test_error',
      }),
    ).rejects.toBeInstanceOf(PaymentGatewayError);
  });

  it('returns the same authorization when create is retried for the same payment', async () => {
    const first = await gateway.createAuthorization(input);
    const second = await gateway.createAuthorization(input);
    expect(second).toEqual(first);
  });

  it('captures an authorized mock payment without inventing a paid-out payout', async () => {
    const authorized = await gateway.createAuthorization(input);
    const captured = await gateway.captureAuthorization(authorized.providerPaymentId);
    expect(captured).toEqual({
      providerPaymentId: 'mock_auth_payment_1',
      status: 'CAPTURED',
    });
    await expect(gateway.captureAuthorization(authorized.providerPaymentId)).resolves.toEqual(captured);
  });

  it('does not capture a declined authorization', async () => {
    const declined = await gateway.createAuthorization({
      ...input,
      paymentMethodRef: 'pm_test_declined',
    });
    const result = await gateway.captureAuthorization(declined.providerPaymentId);
    expect(result.status).toBe('FAILED');
  });
});
