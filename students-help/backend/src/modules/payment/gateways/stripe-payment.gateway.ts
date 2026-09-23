import { PaymentGatewayError } from '../payment.errors.js';
import type {
  CreateAuthorizationInput,
  GatewayAuthorizationResult,
  GatewayCaptureResult,
} from '../payment.types.js';
import type { PaymentGateway } from './payment-gateway.interface.js';

export type StripeIntentStatus =
  | 'requires_payment_method'
  | 'requires_confirmation'
  | 'requires_action'
  | 'requires_capture'
  | 'processing'
  | 'succeeded'
  | 'canceled';

export type StripeIntentLike = {
  id: string;
  status: StripeIntentStatus;
  amount: number;
  currency: string;
  last_payment_error?: { code?: string; decline_code?: string } | null;
};

export type StripeIntentClient = {
  createPaymentIntent(input: {
    amountMinor: number;
    currency: string;
    idempotencyKey: string;
    bookingId: string;
    paymentId: string;
    paymentMethodRef?: string;
  }): Promise<StripeIntentLike>;
  retrievePaymentIntent(providerPaymentId: string): Promise<StripeIntentLike>;
  cancelPaymentIntent(providerPaymentId: string): Promise<StripeIntentLike>;
  capturePaymentIntent(providerPaymentId: string): Promise<StripeIntentLike>;
};

export function mapStripeIntentStatus(intent: StripeIntentLike): GatewayAuthorizationResult {
  if (intent.status === 'requires_capture') {
    return { providerPaymentId: intent.id, status: 'AUTHORIZED' };
  }
  if (intent.status === 'canceled') {
    return { providerPaymentId: intent.id, status: 'CANCELLED' };
  }
  if (intent.status === 'requires_payment_method' || intent.status === 'requires_action') {
    const decline = intent.last_payment_error?.decline_code ?? intent.last_payment_error?.code;
    if (decline) {
      return { providerPaymentId: intent.id, status: 'FAILED', failureCode: 'DECLINED' };
    }
    return { providerPaymentId: intent.id, status: 'REQUIRES_PAYMENT_METHOD' };
  }
  if (intent.status === 'processing' || intent.status === 'requires_confirmation') {
    return { providerPaymentId: intent.id, status: 'REQUIRES_PAYMENT_METHOD' };
  }
  return { providerPaymentId: intent.id, status: 'FAILED', failureCode: 'PROVIDER_ERROR' };
}

export function mapStripeCaptureStatus(intent: StripeIntentLike): GatewayCaptureResult {
  if (intent.status === 'succeeded') {
    return { providerPaymentId: intent.id, status: 'CAPTURED' };
  }
  if (intent.status === 'canceled') {
    return { providerPaymentId: intent.id, status: 'CANCELLED' };
  }
  return { providerPaymentId: intent.id, status: 'FAILED', failureCode: 'PROVIDER_ERROR' };
}

/**
 * Maps Stripe PaymentIntent manual-capture responses into domain authorization
 * results. Does not import the Stripe SDK. Connect application fees and
 * destination charges are deferred until Student connected accounts exist.
 */
export class StripePaymentGateway implements PaymentGateway {
  readonly provider = 'STRIPE' as const;

  constructor(private readonly client: StripeIntentClient) {}

  async createAuthorization(input: CreateAuthorizationInput): Promise<GatewayAuthorizationResult> {
    try {
      const intent = await this.client.createPaymentIntent({
        amountMinor: input.amountMinor,
        currency: input.currency,
        idempotencyKey: input.idempotencyKey,
        bookingId: input.bookingId,
        paymentId: input.paymentId,
        paymentMethodRef: input.paymentMethodRef,
      });
      return mapStripeIntentStatus(intent);
    } catch (error) {
      if (error instanceof PaymentGatewayError) {
        throw error;
      }
      throw new PaymentGatewayError('PROVIDER_ERROR', 'Stripe authorization could not be created.');
    }
  }

  async retrieveAuthorization(providerPaymentId: string): Promise<GatewayAuthorizationResult> {
    try {
      const intent = await this.client.retrievePaymentIntent(providerPaymentId);
      return mapStripeIntentStatus(intent);
    } catch (error) {
      if (error instanceof PaymentGatewayError) {
        throw error;
      }
      throw new PaymentGatewayError('PROVIDER_ERROR', 'Stripe authorization could not be retrieved.');
    }
  }

  async cancelAuthorization(providerPaymentId: string): Promise<GatewayAuthorizationResult> {
    try {
      const intent = await this.client.cancelPaymentIntent(providerPaymentId);
      return mapStripeIntentStatus(intent);
    } catch (error) {
      if (error instanceof PaymentGatewayError) {
        throw error;
      }
      throw new PaymentGatewayError('PROVIDER_ERROR', 'Stripe authorization could not be cancelled.');
    }
  }

  async captureAuthorization(providerPaymentId: string): Promise<GatewayCaptureResult> {
    try {
      const intent = await this.client.capturePaymentIntent(providerPaymentId);
      return mapStripeCaptureStatus(intent);
    } catch (error) {
      if (error instanceof PaymentGatewayError) {
        throw error;
      }
      throw new PaymentGatewayError('PROVIDER_ERROR', 'Stripe authorization could not be captured.');
    }
  }
}

export class HttpStripeIntentClient implements StripeIntentClient {
  constructor(private readonly secretKey: string) {}

  async createPaymentIntent(input: {
    amountMinor: number;
    currency: string;
    idempotencyKey: string;
    bookingId: string;
    paymentId: string;
    paymentMethodRef?: string;
  }): Promise<StripeIntentLike> {
    const body = new URLSearchParams({
      amount: String(input.amountMinor),
      currency: input.currency.toLowerCase(),
      capture_method: 'manual',
      'metadata[bookingId]': input.bookingId,
      'metadata[paymentId]': input.paymentId,
    });
    if (input.paymentMethodRef) {
      body.set('payment_method', input.paymentMethodRef);
      body.set('confirm', 'true');
    }
    return this.request('POST', '/v1/payment_intents', body, input.idempotencyKey);
  }

  async retrievePaymentIntent(providerPaymentId: string): Promise<StripeIntentLike> {
    return this.request('GET', `/v1/payment_intents/${encodeURIComponent(providerPaymentId)}`);
  }

  async cancelPaymentIntent(providerPaymentId: string): Promise<StripeIntentLike> {
    return this.request(
      'POST',
      `/v1/payment_intents/${encodeURIComponent(providerPaymentId)}/cancel`,
    );
  }

  async capturePaymentIntent(providerPaymentId: string): Promise<StripeIntentLike> {
    return this.request(
      'POST',
      `/v1/payment_intents/${encodeURIComponent(providerPaymentId)}/capture`,
    );
  }

  private async request(
    method: 'GET' | 'POST',
    path: string,
    body?: URLSearchParams,
    idempotencyKey?: string,
  ): Promise<StripeIntentLike> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.secretKey}`,
      Accept: 'application/json',
    };
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }
    if (body) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }

    const response = await fetch(`https://api.stripe.com${path}`, {
      method,
      headers,
      body: body?.toString(),
    });

    const payload = (await response.json().catch(() => null)) as
      | StripeIntentLike
      | { error?: { code?: string; decline_code?: string; type?: string } }
      | null;

    if (!response.ok) {
      const decline =
        payload && 'error' in payload
          ? payload.error?.decline_code ?? payload.error?.code ?? 'PROVIDER_ERROR'
          : 'PROVIDER_ERROR';
      throw new PaymentGatewayError(
        decline === 'card_declined' ? 'DECLINED' : 'PROVIDER_ERROR',
        'Stripe request failed.',
      );
    }

    if (!payload || !('id' in payload) || !('status' in payload)) {
      throw new PaymentGatewayError('PROVIDER_ERROR', 'Stripe returned an unexpected response.');
    }

    return payload;
  }
}
