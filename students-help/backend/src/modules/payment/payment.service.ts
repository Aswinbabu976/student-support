import { BookingStatus, PaymentStatus, type Payment, type PrismaClient } from '@prisma/client';
import {
  AppError,
  bookingNotFound,
  bookingNotPaymentEligible,
  forbidden,
  paymentAuthorizationFailed,
  paymentProviderError,
} from '../../shared/errors.js';
import { isUniqueConstraintError } from '../../shared/prisma-errors.js';
import { logger } from '../../shared/logger.js';
import { canConfirmBooking } from '../booking/booking.transition.js';
import type { PricingService } from '../pricing/pricing.service.js';
import { PaymentGatewayError } from './payment.errors.js';
import { PaymentRepository } from './payment.repository.js';
import type { PaymentGateway } from './gateways/payment-gateway.interface.js';
import {
  ACTIVE_PAYMENT_STATUSES,
  type AuthorizePaymentInput,
  type GatewayAuthorizationResult,
  type PublicPaymentView,
} from './payment.types.js';

type PaymentServiceDeps = {
  prisma: PrismaClient;
  pricingService: PricingService;
  gateway: PaymentGateway;
};

type OwnedBooking = {
  id: string;
  status: BookingStatus;
  estimatedDurationMinutes: number;
};

export class PaymentService {
  private readonly payments: PaymentRepository;

  constructor(private readonly deps: PaymentServiceDeps) {
    this.payments = new PaymentRepository(deps.prisma);
  }

  async getForHelpSeeker(userId: string, bookingId: string): Promise<PublicPaymentView | null> {
    await this.loadOwnedBooking(userId, bookingId, { requireAccepted: false });
    const payment = await this.payments.findLatestByBookingId(bookingId);
    if (!payment) {
      return null;
    }
    const reconciled = await this.reconcileIfNeeded(payment);
    return toPublicView(reconciled);
  }

  async isBookingFundedForExecution(bookingId: string): Promise<boolean> {
    const payment = await this.payments.findLatestByBookingId(bookingId);
    return payment?.status === PaymentStatus.AUTHORIZED;
  }

  async isPaymentEligibleForCompletion(bookingId: string): Promise<boolean> {
    const payment = await this.payments.findLatestByBookingId(bookingId);
    return (
      payment?.status === PaymentStatus.AUTHORIZED || payment?.status === PaymentStatus.CAPTURED
    );
  }

  async releaseOrCaptureForCompletedBooking(bookingId: string): Promise<void> {
    const payment = await this.payments.findLatestByBookingId(bookingId);
    if (!payment) {
      logger.warn('Payment capture skipped because no payment exists', { bookingId });
      return;
    }
    if (payment.status === PaymentStatus.CAPTURED) {
      return;
    }
    if (payment.status !== PaymentStatus.AUTHORIZED || !payment.providerPaymentId) {
      logger.warn('Payment capture skipped because authorization is not capturable', {
        bookingId,
        paymentId: payment.id,
        status: payment.status,
      });
      return;
    }

    try {
      const result = await this.deps.gateway.captureAuthorization(payment.providerPaymentId);
      if (result.status !== PaymentStatus.CAPTURED) {
        logger.warn('Payment capture did not succeed', {
          bookingId,
          paymentId: payment.id,
          status: result.status,
        });
        return;
      }
      await this.payments.updateFromGateway(payment.id, {
        status: PaymentStatus.CAPTURED,
        capturedAt: new Date(),
      });
      logger.info('Payment captured for completed booking', {
        paymentId: payment.id,
        bookingId,
      });
    } catch (error) {
      logger.warn('Payment capture could not be completed', {
        bookingId,
        paymentId: payment.id,
        failureCode: error instanceof PaymentGatewayError ? error.failureCode : 'PROVIDER_ERROR',
      });
    }
  }

  async authorizeForHelpSeeker(
    userId: string,
    bookingId: string,
    input: AuthorizePaymentInput,
  ): Promise<PublicPaymentView> {
    const booking = await this.loadOwnedBooking(userId, bookingId, { requirePaymentEligible: true });
    const estimate = this.deps.pricingService.estimateFromDurationMinutes(
      booking.estimatedDurationMinutes,
    );

    if (booking.status === BookingStatus.CONFIRMED) {
      const existing =
        (await this.payments.findActiveByBookingId(bookingId)) ??
        (await this.payments.findLatestByBookingId(bookingId));
      if (existing?.status === PaymentStatus.AUTHORIZED) {
        return toPublicView(existing);
      }
      throw bookingNotPaymentEligible();
    }

    const active = await this.payments.findActiveByBookingId(bookingId);
    if (active?.status === PaymentStatus.AUTHORIZED) {
      return this.withConfirmedBooking(userId, bookingId, active);
    }
    if (active) {
      return this.completeAuthorization(userId, active, input.paymentMethodRef);
    }

    const attemptCount = await this.payments.countByBookingId(bookingId);
    const idempotencyKey =
      attemptCount === 0
        ? `payment-authorization:${bookingId}`
        : `payment-authorization:${bookingId}:${attemptCount}`;

    let pending: Payment;
    try {
      pending = await this.payments.createPending({
        bookingId,
        provider: this.deps.gateway.provider,
        idempotencyKey,
        amountMinor: estimate.total.amountMinor,
        platformFeeMinor: estimate.platformFee.amountMinor,
        currency: estimate.currency,
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
      const existing =
        (await this.payments.findByIdempotencyKey(idempotencyKey)) ??
        (await this.payments.findActiveByBookingId(bookingId));
      if (!existing) {
        throw error;
      }
      if (existing.status === PaymentStatus.AUTHORIZED) {
        return this.withConfirmedBooking(userId, bookingId, existing);
      }
      return this.completeAuthorization(userId, existing, input.paymentMethodRef);
    }

    return this.completeAuthorization(userId, pending, input.paymentMethodRef);
  }

  private async completeAuthorization(
    userId: string,
    payment: Payment,
    paymentMethodRef?: string,
  ): Promise<PublicPaymentView> {
    if (payment.status === PaymentStatus.AUTHORIZED) {
      return this.withConfirmedBooking(userId, payment.bookingId, payment);
    }

    if (
      payment.status === PaymentStatus.AUTHORIZATION_PENDING &&
      payment.providerPaymentId
    ) {
      const reconciled = await this.reconcileIfNeeded(payment);
      if (ACTIVE_PAYMENT_STATUSES.includes(reconciled.status) && reconciled.status !== PaymentStatus.AUTHORIZATION_PENDING) {
        if (reconciled.status === PaymentStatus.FAILED) {
          throw paymentAuthorizationFailed();
        }
        if (reconciled.status === PaymentStatus.AUTHORIZED) {
          return this.withConfirmedBooking(userId, payment.bookingId, reconciled);
        }
        return toPublicView(reconciled);
      }
    }

    try {
      const result = await this.deps.gateway.createAuthorization({
        amountMinor: payment.amountMinor,
        platformFeeMinor: payment.platformFeeMinor,
        currency: payment.currency,
        bookingId: payment.bookingId,
        paymentId: payment.id,
        idempotencyKey: payment.idempotencyKey,
        paymentMethodRef,
      });
      const updated = await this.applyGatewayResult(payment.id, result);
      logger.info('Payment authorization updated', {
        paymentId: updated.id,
        bookingId: updated.bookingId,
        status: updated.status,
      });
      if (updated.status === PaymentStatus.FAILED) {
        throw paymentAuthorizationFailed();
      }
      if (updated.status === PaymentStatus.AUTHORIZED) {
        return this.withConfirmedBooking(userId, updated.bookingId, updated);
      }
      return toPublicView(updated);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      if (error instanceof PaymentGatewayError && error.failureCode === 'DECLINED') {
        await this.markFailed(payment.id, 'DECLINED');
        throw paymentAuthorizationFailed();
      }
      if (error instanceof PaymentGatewayError) {
        await this.markFailed(payment.id, 'PROVIDER_ERROR');
        throw paymentProviderError();
      }
      await this.markFailed(payment.id, 'PROVIDER_ERROR');
      throw paymentProviderError();
    }
  }

  private async reconcileIfNeeded(payment: Payment): Promise<Payment> {
    if (
      payment.status !== PaymentStatus.AUTHORIZATION_PENDING ||
      !payment.providerPaymentId
    ) {
      return payment;
    }
    try {
      const result = await this.deps.gateway.retrieveAuthorization(payment.providerPaymentId);
      return this.applyGatewayResult(payment.id, result);
    } catch {
      return payment;
    }
  }

  private async applyGatewayResult(
    paymentId: string,
    result: GatewayAuthorizationResult,
  ): Promise<Payment> {
    const failed = result.status === PaymentStatus.FAILED || result.status === PaymentStatus.CANCELLED;
    const authorized = result.status === PaymentStatus.AUTHORIZED;
    return this.payments.updateFromGateway(paymentId, {
      providerPaymentId: result.providerPaymentId,
      status: result.status,
      failureCode: result.failureCode ?? null,
      authorizedAt: authorized ? new Date() : null,
      failedAt: failed ? new Date() : null,
    });
  }

  private async markFailed(paymentId: string, failureCode: string): Promise<void> {
    try {
      await this.payments.updateFromGateway(paymentId, {
        status: PaymentStatus.FAILED,
        failureCode,
        failedAt: new Date(),
      });
    } catch {
      logger.warn('Payment failure state could not be persisted', { paymentId });
    }
  }

  private async withConfirmedBooking(
    userId: string,
    bookingId: string,
    payment: Payment,
  ): Promise<PublicPaymentView> {
    if (payment.status === PaymentStatus.AUTHORIZED) {
      await this.confirmWhenAuthorized(userId, bookingId);
    }
    return toPublicView(payment);
  }

  private async confirmWhenAuthorized(userId: string, bookingId: string): Promise<void> {
    await this.deps.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        select: { status: true },
      });
      if (!booking || !canConfirmBooking(booking.status)) {
        return;
      }
      const updated = await tx.booking.updateMany({
        where: { id: bookingId, status: BookingStatus.ACCEPTED },
        data: { status: BookingStatus.CONFIRMED },
      });
      if (updated.count !== 1) {
        return;
      }
      await tx.bookingStatusHistory.create({
        data: {
          bookingId,
          fromStatus: BookingStatus.ACCEPTED,
          toStatus: BookingStatus.CONFIRMED,
          changedByUserId: userId,
        },
      });
    });
  }

  private async loadOwnedBooking(
    userId: string,
    bookingId: string,
    options: { requireAccepted?: boolean; requirePaymentEligible?: boolean },
  ): Promise<OwnedBooking> {
    const seeker = await this.deps.prisma.helpSeekerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!seeker) {
      throw forbidden();
    }

    const booking = await this.deps.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        helpSeekerProfileId: true,
        task: { select: { estimatedDurationMinutes: true } },
      },
    });
    if (!booking) {
      throw bookingNotFound();
    }
    if (booking.helpSeekerProfileId !== seeker.id) {
      throw forbidden();
    }
    if (options.requirePaymentEligible) {
      if (
        booking.status !== BookingStatus.ACCEPTED &&
        booking.status !== BookingStatus.CONFIRMED
      ) {
        throw bookingNotPaymentEligible();
      }
    } else if (options.requireAccepted && booking.status !== BookingStatus.ACCEPTED) {
      throw bookingNotPaymentEligible();
    }

    return {
      id: booking.id,
      status: booking.status,
      estimatedDurationMinutes: booking.task.estimatedDurationMinutes,
    };
  }
}

function toPublicView(payment: Payment): PublicPaymentView {
  return {
    id: payment.id,
    bookingId: payment.bookingId,
    provider: payment.provider,
    status: payment.status,
    amountMinor: payment.amountMinor,
    platformFeeMinor: payment.platformFeeMinor,
    currency: payment.currency,
    authorizedAt: payment.authorizedAt?.toISOString() ?? null,
    failureCode: payment.failureCode,
  };
}
