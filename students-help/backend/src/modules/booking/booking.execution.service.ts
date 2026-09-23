import { BookingStatus, type PrismaClient } from '@prisma/client';
import {
  AppError,
  bookingNotFound,
  bookingUpdateFailed,
  forbidden,
  paymentNotAuthorized,
  taskAlreadyCompleted,
  taskAlreadyStarted,
  taskAlreadySubmitted,
  taskNotStarted,
  taskNotSubmitted,
} from '../../shared/errors.js';
import type { PaymentService } from '../payment/payment.service.js';
import type { BookingService } from './booking.service.js';
import {
  canConfirmCompletion,
  canStartBooking,
  canSubmitCompletion,
  errorForNonCompletable,
  errorForNonConfirmable,
  errorForNonStartable,
} from './booking.transition.js';
import type { BookingView } from './booking.types.js';

type BookingExecutionServiceDeps = {
  prisma: PrismaClient;
  paymentService: PaymentService;
  bookingService: BookingService;
};

export class BookingExecutionService {
  constructor(private readonly deps: BookingExecutionServiceDeps) {}

  async start(userId: string, bookingId: string): Promise<BookingView> {
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
        startedAt: true,
      },
    });
    if (!booking) {
      throw bookingNotFound();
    }
    if (booking.studentProfileId !== student.id) {
      throw forbidden();
    }
    if (!canStartBooking(booking.status)) {
      throw errorForNonStartable(booking.status);
    }

    const funded = await this.deps.paymentService.isBookingFundedForExecution(bookingId);
    if (!funded) {
      throw paymentNotAuthorized();
    }

    const startedAt = new Date();
    try {
      await this.deps.prisma.$transaction(async (tx) => {
        const updated = await tx.booking.updateMany({
          where: {
            id: booking.id,
            status: BookingStatus.CONFIRMED,
            startedAt: null,
          },
          data: {
            status: BookingStatus.IN_PROGRESS,
            startedAt,
          },
        });
        if (updated.count !== 1) {
          const current = await tx.booking.findUnique({
            where: { id: booking.id },
            select: { status: true, startedAt: true },
          });
          if (current?.status === BookingStatus.IN_PROGRESS || current?.startedAt) {
            throw taskAlreadyStarted();
          }
          throw errorForNonStartable(current?.status ?? BookingStatus.CANCELLED);
        }

        await tx.bookingStatusHistory.create({
          data: {
            bookingId: booking.id,
            fromStatus: BookingStatus.CONFIRMED,
            toStatus: BookingStatus.IN_PROGRESS,
            changedByUserId: userId,
          },
        });
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw bookingUpdateFailed();
    }

    return this.deps.bookingService.getById(userId, bookingId);
  }

  async markDone(userId: string, bookingId: string): Promise<BookingView> {
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
        startedAt: true,
        submittedForSignoffAt: true,
      },
    });
    if (!booking) {
      throw bookingNotFound();
    }
    if (booking.studentProfileId !== student.id) {
      throw forbidden();
    }
    if (!canSubmitCompletion(booking.status)) {
      throw errorForNonCompletable(booking.status);
    }
    if (!booking.startedAt) {
      throw taskNotStarted();
    }

    const submittedForSignoffAt = new Date();
    try {
      await this.deps.prisma.$transaction(async (tx) => {
        const updated = await tx.booking.updateMany({
          where: {
            id: booking.id,
            status: BookingStatus.IN_PROGRESS,
            startedAt: { not: null },
            submittedForSignoffAt: null,
          },
          data: {
            status: BookingStatus.AWAITING_SIGNOFF,
            submittedForSignoffAt,
          },
        });
        if (updated.count !== 1) {
          const current = await tx.booking.findUnique({
            where: { id: booking.id },
            select: { status: true, startedAt: true, submittedForSignoffAt: true },
          });
          if (
            current?.status === BookingStatus.AWAITING_SIGNOFF ||
            current?.submittedForSignoffAt
          ) {
            throw taskAlreadySubmitted();
          }
          if (!current?.startedAt) {
            throw taskNotStarted();
          }
          throw errorForNonCompletable(current?.status ?? BookingStatus.CANCELLED);
        }

        await tx.bookingStatusHistory.create({
          data: {
            bookingId: booking.id,
            fromStatus: BookingStatus.IN_PROGRESS,
            toStatus: BookingStatus.AWAITING_SIGNOFF,
            changedByUserId: userId,
          },
        });
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw bookingUpdateFailed();
    }

    return this.deps.bookingService.getById(userId, bookingId);
  }

  async confirmCompletion(userId: string, bookingId: string): Promise<BookingView> {
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
        submittedForSignoffAt: true,
        completedAt: true,
      },
    });
    if (!booking) {
      throw bookingNotFound();
    }
    if (booking.helpSeekerProfileId !== seeker.id) {
      throw forbidden();
    }
    if (!canConfirmCompletion(booking.status)) {
      throw errorForNonConfirmable(booking.status);
    }
    if (!booking.submittedForSignoffAt) {
      throw taskNotSubmitted();
    }

    const eligible = await this.deps.paymentService.isPaymentEligibleForCompletion(bookingId);
    if (!eligible) {
      throw paymentNotAuthorized();
    }

    const completedAt = new Date();
    try {
      await this.deps.prisma.$transaction(async (tx) => {
        const updated = await tx.booking.updateMany({
          where: {
            id: booking.id,
            status: BookingStatus.AWAITING_SIGNOFF,
            submittedForSignoffAt: { not: null },
            completedAt: null,
          },
          data: {
            status: BookingStatus.COMPLETED,
            completedAt,
          },
        });
        if (updated.count !== 1) {
          const current = await tx.booking.findUnique({
            where: { id: booking.id },
            select: { status: true, submittedForSignoffAt: true, completedAt: true },
          });
          if (current?.status === BookingStatus.COMPLETED || current?.completedAt) {
            throw taskAlreadyCompleted();
          }
          if (!current?.submittedForSignoffAt) {
            throw taskNotSubmitted();
          }
          throw errorForNonConfirmable(current?.status ?? BookingStatus.CANCELLED);
        }

        await tx.bookingStatusHistory.create({
          data: {
            bookingId: booking.id,
            fromStatus: BookingStatus.AWAITING_SIGNOFF,
            toStatus: BookingStatus.COMPLETED,
            changedByUserId: userId,
          },
        });
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw bookingUpdateFailed();
    }

    await this.deps.paymentService.releaseOrCaptureForCompletedBooking(bookingId);
    return this.deps.bookingService.getById(userId, bookingId);
  }
}
