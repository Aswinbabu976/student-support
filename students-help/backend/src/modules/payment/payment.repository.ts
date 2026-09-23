import {
  PaymentStatus,
  type Payment,
  type PaymentProvider,
  type PrismaClient,
} from '@prisma/client';
import { ACTIVE_PAYMENT_STATUSES } from './payment.types.js';

type PaymentRecord = Payment;

export class PaymentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findLatestByBookingId(bookingId: string): Promise<PaymentRecord | null> {
    return this.prisma.payment.findFirst({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findActiveByBookingId(bookingId: string): Promise<PaymentRecord | null> {
    return this.prisma.payment.findFirst({
      where: {
        bookingId,
        status: { in: ACTIVE_PAYMENT_STATUSES },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findByIdempotencyKey(idempotencyKey: string): Promise<PaymentRecord | null> {
    return this.prisma.payment.findUnique({
      where: { idempotencyKey },
    });
  }

  countByBookingId(bookingId: string): Promise<number> {
    return this.prisma.payment.count({ where: { bookingId } });
  }

  createPending(input: {
    bookingId: string;
    provider: PaymentProvider;
    idempotencyKey: string;
    amountMinor: number;
    platformFeeMinor: number;
    currency: string;
  }): Promise<PaymentRecord> {
    return this.prisma.payment.create({
      data: {
        bookingId: input.bookingId,
        provider: input.provider,
        idempotencyKey: input.idempotencyKey,
        amountMinor: input.amountMinor,
        platformFeeMinor: input.platformFeeMinor,
        currency: input.currency,
        status: PaymentStatus.AUTHORIZATION_PENDING,
      },
    });
  }

  updateFromGateway(
    paymentId: string,
    data: {
      providerPaymentId?: string;
      status: PaymentStatus;
      failureCode?: string | null;
      authorizedAt?: Date | null;
      capturedAt?: Date | null;
      failedAt?: Date | null;
    },
  ): Promise<PaymentRecord> {
    return this.prisma.payment.update({
      where: { id: paymentId },
      data,
    });
  }
}
