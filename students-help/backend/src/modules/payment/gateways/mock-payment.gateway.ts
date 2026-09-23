import { PaymentGatewayError } from '../payment.errors.js';
import type {
  CreateAuthorizationInput,
  GatewayAuthorizationResult,
  GatewayCaptureResult,
} from '../payment.types.js';
import type { PaymentGateway } from './payment-gateway.interface.js';

const SUCCESS_REF = 'pm_test_success';
const DECLINED_REF = 'pm_test_declined';
const ERROR_REF = 'pm_test_error';

/**
 * Deterministic local gateway. It never contacts a payment network and never
 * reserves funds. Results are recorded for API/contract tests only.
 */
export class MockPaymentGateway implements PaymentGateway {
  readonly provider = 'MOCK' as const;
  private readonly authorizations = new Map<string, GatewayAuthorizationResult>();
  private readonly captures = new Map<string, GatewayCaptureResult>();

  async createAuthorization(input: CreateAuthorizationInput): Promise<GatewayAuthorizationResult> {
    const existing = [...this.authorizations.values()].find(
      (item) => item.providerPaymentId === `mock_auth_${input.paymentId}`,
    );
    if (existing) {
      return existing;
    }

    const paymentMethodRef = input.paymentMethodRef ?? SUCCESS_REF;
    if (paymentMethodRef === ERROR_REF) {
      throw new PaymentGatewayError('PROVIDER_ERROR', 'Mock payment provider error.');
    }

    const providerPaymentId = `mock_auth_${input.paymentId}`;
    const result: GatewayAuthorizationResult =
      paymentMethodRef === DECLINED_REF
        ? { providerPaymentId, status: 'FAILED', failureCode: 'DECLINED' }
        : paymentMethodRef === SUCCESS_REF
          ? { providerPaymentId, status: 'AUTHORIZED' }
          : { providerPaymentId, status: 'REQUIRES_PAYMENT_METHOD' };

    this.authorizations.set(providerPaymentId, result);
    return result;
  }

  async retrieveAuthorization(providerPaymentId: string): Promise<GatewayAuthorizationResult> {
    const result = this.authorizations.get(providerPaymentId);
    if (!result) {
      throw new PaymentGatewayError('PROVIDER_ERROR', 'Mock authorization was not found.');
    }
    return result;
  }

  async cancelAuthorization(providerPaymentId: string): Promise<GatewayAuthorizationResult> {
    const current = await this.retrieveAuthorization(providerPaymentId);
    const cancelled: GatewayAuthorizationResult = {
      ...current,
      status: 'CANCELLED',
    };
    this.authorizations.set(providerPaymentId, cancelled);
    return cancelled;
  }

  async captureAuthorization(providerPaymentId: string): Promise<GatewayCaptureResult> {
    const existingCapture = this.captures.get(providerPaymentId);
    if (existingCapture) {
      return existingCapture;
    }

    const current = await this.retrieveAuthorization(providerPaymentId);
    if (current.status !== 'AUTHORIZED') {
      const failed: GatewayCaptureResult = {
        providerPaymentId,
        status: 'FAILED',
        failureCode: 'PROVIDER_ERROR',
      };
      this.captures.set(providerPaymentId, failed);
      return failed;
    }

    const captured: GatewayCaptureResult = {
      providerPaymentId,
      status: 'CAPTURED',
    };
    this.captures.set(providerPaymentId, captured);
    return captured;
  }
}
