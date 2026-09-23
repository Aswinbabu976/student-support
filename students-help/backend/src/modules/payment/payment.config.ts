import type { AppEnv } from '../../config/env.js';
import type { PaymentGateway } from './gateways/payment-gateway.interface.js';
import { MockPaymentGateway } from './gateways/mock-payment.gateway.js';
import {
  HttpStripeIntentClient,
  StripePaymentGateway,
} from './gateways/stripe-payment.gateway.js';

export function createPaymentGateway(env: AppEnv): PaymentGateway {
  if (env.PAYMENT_PROVIDER !== 'stripe') {
    return new MockPaymentGateway();
  }

  if (!env.PAYMENT_SECRET_KEY.startsWith('sk_test_')) {
    return new MockPaymentGateway();
  }

  return new StripePaymentGateway(new HttpStripeIntentClient(env.PAYMENT_SECRET_KEY));
}
