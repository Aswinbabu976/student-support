import type { PaymentProvider } from '@prisma/client';
import type {
  CreateAuthorizationInput,
  GatewayAuthorizationResult,
  GatewayCaptureResult,
} from '../payment.types.js';

export interface PaymentGateway {
  readonly provider: PaymentProvider;
  createAuthorization(input: CreateAuthorizationInput): Promise<GatewayAuthorizationResult>;
  retrieveAuthorization(providerPaymentId: string): Promise<GatewayAuthorizationResult>;
  cancelAuthorization(providerPaymentId: string): Promise<GatewayAuthorizationResult>;
  captureAuthorization(providerPaymentId: string): Promise<GatewayCaptureResult>;
}
