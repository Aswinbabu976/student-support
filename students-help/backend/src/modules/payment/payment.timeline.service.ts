import { BookingStatus, type PrismaClient } from '@prisma/client';
import {
  bookingNotFound,
  forbidden,
  paymentTimelineUnavailable,
} from '../../shared/errors.js';
import type { PricingService } from '../pricing/pricing.service.js';
import { PaymentRepository } from './payment.repository.js';
import {
  buildPaymentTimeline,
  executionStateFromBookingStatus,
  payoutStateFromPaymentStatus,
} from './payment.timeline.js';
import type { PaymentTimelineView } from './payment.timeline.types.js';

type PaymentTimelineServiceDeps = {
  prisma: PrismaClient;
  pricingService: PricingService;
};

export class PaymentTimelineService {
  private readonly payments: PaymentRepository;

  constructor(private readonly deps: PaymentTimelineServiceDeps) {
    this.payments = new PaymentRepository(deps.prisma);
  }

  async getForStudent(userId: string, bookingId: string): Promise<PaymentTimelineView> {
    const student = await this.deps.prisma.studentProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!student) {
      throw forbidden();
    }

    const booking = await this.deps.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        studentProfileId: true,
        updatedAt: true,
        statusHistory: {
          orderBy: { createdAt: 'asc' },
          select: { toStatus: true, createdAt: true },
        },
        task: { select: { estimatedDurationMinutes: true } },
      },
    });
    if (!booking) {
      throw bookingNotFound();
    }
    if (booking.studentProfileId !== student.id) {
      throw forbidden();
    }

    const payment = await this.payments.findLatestByBookingId(bookingId);
    const amounts = this.resolveAmounts(
      booking.task.estimatedDurationMinutes,
      payment
        ? {
            amountMinor: payment.amountMinor,
            platformFeeMinor: payment.platformFeeMinor,
            currency: payment.currency,
          }
        : null,
    );

    const acceptedEvent = booking.statusHistory.find((event) => event.toStatus === BookingStatus.ACCEPTED);
    const acceptedAt =
      acceptedEvent?.createdAt.toISOString() ??
      (booking.status === BookingStatus.ACCEPTED ||
        booking.status === BookingStatus.CONFIRMED ||
        booking.status === BookingStatus.IN_PROGRESS ||
        booking.status === BookingStatus.AWAITING_SIGNOFF ||
        booking.status === BookingStatus.COMPLETED
        ? booking.updatedAt.toISOString()
        : null);

    return buildPaymentTimeline({
      bookingId: booking.id,
      bookingStatus: booking.status,
      acceptedAt,
      paymentStatus: payment?.status ?? null,
      authorizedAt: payment?.authorizedAt?.toISOString() ?? null,
      failedAt: payment?.failedAt?.toISOString() ?? null,
      currency: amounts.currency,
      taskAmountMinor: amounts.taskAmountMinor,
      platformFeeMinor: amounts.platformFeeMinor,
      customerTotalMinor: amounts.customerTotalMinor,
      executionState: executionStateFromBookingStatus(booking.status),
      payoutState: payoutStateFromPaymentStatus(payment?.status ?? null),
    });
  }

  private resolveAmounts(
    estimatedDurationMinutes: number,
    payment: { amountMinor: number; platformFeeMinor: number; currency: string } | null,
  ): {
    currency: string;
    taskAmountMinor: number;
    platformFeeMinor: number;
    customerTotalMinor: number;
  } {
    if (payment) {
      if (
        !Number.isInteger(payment.amountMinor) ||
        !Number.isInteger(payment.platformFeeMinor) ||
        payment.amountMinor < 0 ||
        payment.platformFeeMinor < 0 ||
        payment.platformFeeMinor > payment.amountMinor
      ) {
        throw paymentTimelineUnavailable();
      }
      return {
        currency: payment.currency,
        taskAmountMinor: payment.amountMinor - payment.platformFeeMinor,
        platformFeeMinor: payment.platformFeeMinor,
        customerTotalMinor: payment.amountMinor,
      };
    }

    const estimate = this.deps.pricingService.estimateFromDurationMinutes(estimatedDurationMinutes);
    return {
      currency: estimate.currency,
      taskAmountMinor: estimate.subtotal.amountMinor,
      platformFeeMinor: estimate.platformFee.amountMinor,
      customerTotalMinor: estimate.total.amountMinor,
    };
  }
}
