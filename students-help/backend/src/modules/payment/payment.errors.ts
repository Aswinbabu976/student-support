export class PaymentGatewayError extends Error {
  readonly failureCode: string;

  constructor(failureCode: string, message: string) {
    super(message);
    this.name = 'PaymentGatewayError';
    this.failureCode = failureCode;
  }
}
