import { describe, expect, it } from 'vitest';
import { PaymentGatewayError } from '../payment.errors.js';
import {
  mapStripeIntentStatus,
  StripePaymentGateway,
  type StripeIntentClient,
  type StripeIntentLike,
} from './stripe-payment.gateway.js';

function intent(status: StripeIntentLike['status'], extra: Partial<StripeIntentLike> = {}): StripeIntentLike {
  return {
    id: 'pi_test_1',
    status,
    amount: 4950,
    currency: 'eur',
    ...extra,
  };
}

describe('mapStripeIntentStatus', () => {
  it('maps requires_capture to AUTHORIZED', () => {
    expect(mapStripeIntentStatus(intent('requires_capture'))).toEqual({
      providerPaymentId: 'pi_test_1',
      status: 'AUTHORIZED',
    });
  });

  it('maps requires_payment_method to REQUIRES_PAYMENT_METHOD', () => {
    expect(mapStripeIntentStatus(intent('requires_payment_method'))).toEqual({
      providerPaymentId: 'pi_test_1',
      status: 'REQUIRES_PAYMENT_METHOD',
    });
  });

  it('maps a declined requires_payment_method to FAILED', () => {
    expect(
      mapStripeIntentStatus(
        intent('requires_payment_method', {
          last_payment_error: { decline_code: 'generic_decline' },
        }),
      ),
    ).toEqual({
      providerPaymentId: 'pi_test_1',
      status: 'FAILED',
      failureCode: 'DECLINED',
    });
  });

  it('maps canceled to CANCELLED', () => {
    expect(mapStripeIntentStatus(intent('canceled')).status).toBe('CANCELLED');
  });
});

describe('StripePaymentGateway', () => {
  it('maps a successful manual-capture intent into domain AUTHORIZED', async () => {
    const client: StripeIntentClient = {
      async createPaymentIntent() {
        return intent('requires_capture');
      },
      async retrievePaymentIntent() {
        return intent('requires_capture');
      },
      async cancelPaymentIntent() {
        return intent('canceled');
      },
      async capturePaymentIntent() {
        return intent('succeeded');
      },
    };
    const gateway = new StripePaymentGateway(client);
    const result = await gateway.createAuthorization({
      amountMinor: 4950,
      platformFeeMinor: 450,
      currency: 'EUR',
      bookingId: 'booking_1',
      paymentId: 'payment_1',
      idempotencyKey: 'payment-authorization:booking_1',
    });
    expect(result.status).toBe('AUTHORIZED');
    expect(result.providerPaymentId).toBe('pi_test_1');
    expect(gateway.provider).toBe('STRIPE');
  });

  it('maps a captured intent into domain CAPTURED', async () => {
    const client: StripeIntentClient = {
      async createPaymentIntent() {
        return intent('requires_capture');
      },
      async retrievePaymentIntent() {
        return intent('requires_capture');
      },
      async cancelPaymentIntent() {
        return intent('canceled');
      },
      async capturePaymentIntent() {
        return intent('succeeded');
      },
    };
    const gateway = new StripePaymentGateway(client);
    const result = await gateway.captureAuthorization('pi_test_1');
    expect(result).toEqual({
      providerPaymentId: 'pi_test_1',
      status: 'CAPTURED',
    });
  });

  it('wraps client failures as provider errors', async () => {
    const client: StripeIntentClient = {
      async createPaymentIntent() {
        throw new Error('network down');
      },
      async retrievePaymentIntent() {
        throw new Error('network down');
      },
      async cancelPaymentIntent() {
        throw new Error('network down');
      },
      async capturePaymentIntent() {
        throw new Error('network down');
      },
    };
    const gateway = new StripePaymentGateway(client);
    await expect(
      gateway.createAuthorization({
        amountMinor: 4950,
        platformFeeMinor: 450,
        currency: 'EUR',
        bookingId: 'booking_1',
        paymentId: 'payment_1',
        idempotencyKey: 'payment-authorization:booking_1',
      }),
    ).rejects.toBeInstanceOf(PaymentGatewayError);
  });
});
