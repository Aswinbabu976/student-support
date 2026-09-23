import {
  BookingStatus,
  TaskStatus,
  UserRole,
  VerificationStatus,
  type PrismaClient,
} from '@prisma/client';
import {
  AppError,
  bookingConflict,
  bookingCreationFailed,
  bookingNotFound,
  bookingRequestAlreadyExists,
  bookingUpdateFailed,
  forbidden,
  studentNotAvailable,
  studentNotEligible,
  studentNotFound,
  taskNotBookable,
  taskNotFound,
} from '../../shared/errors.js';
import { isUniqueConstraintError } from '../../shared/prisma-errors.js';
import { utcToZonedParts } from '../availability/availability.time.js';
import { isAvailableFromSnapshot } from '../availability/availability.service.js';
import { bookingInterval, intervalsOverlap } from './booking.overlap.js';
import { buildBookingProgress, type ProgressAudience } from './booking.progress.js';
import { canAcceptBooking, canRejectBooking, errorForNonPendingAccept } from './booking.transition.js';
import {
  ACTIVE_BOOKING_STATUSES,
  OVERLAP_BLOCKING_STATUSES,
  type BookingView,
} from './booking.types.js';

type BookingServiceDeps = {
  prisma: PrismaClient;
};

const bookingSelect = {
  id: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  startedAt: true,
  submittedForSignoffAt: true,
  completedAt: true,
  rejectionReason: true,
  rejectedAt: true,
  studentProfileId: true,
  helpSeekerProfileId: true,
  studentProfile: {
    select: {
      id: true,
      user: { select: { verificationStatus: true, role: true } },
    },
  },
  task: {
    select: {
      id: true,
      title: true,
      description: true,
      locationLine: true,
      timezone: true,
      preferredStartAt: true,
      estimatedDurationMinutes: true,
      specialInstructions: true,
      status: true,
      helpSeekerProfileId: true,
      skills: {
        select: {
          skill: { select: { id: true, name: true, category: true } },
        },
      },
    },
  },
  statusHistory: {
    orderBy: { createdAt: 'asc' as const },
    select: { toStatus: true, createdAt: true },
  },
} as const;

export class BookingService {
  constructor(private readonly deps: BookingServiceDeps) {}

  async createRequest(userId: string, taskId: string, studentProfileId: string): Promise<BookingView> {
    const seeker = await this.deps.prisma.helpSeekerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!seeker) {
      throw forbidden();
    }

    const task = await this.deps.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        helpSeekerProfileId: true,
        status: true,
        preferredStartAt: true,
        estimatedDurationMinutes: true,
        skills: { select: { skillId: true } },
      },
    });
    if (!task) {
      throw taskNotFound();
    }
    if (task.helpSeekerProfileId !== seeker.id) {
      throw forbidden();
    }
    if (task.status !== TaskStatus.PUBLISHED) {
      throw taskNotBookable();
    }

    const student = await this.deps.prisma.studentProfile.findUnique({
      where: { id: studentProfileId },
      select: {
        id: true,
        timezone: true,
        user: {
          select: {
            role: true,
            verificationStatus: true,
          },
        },
        skills: {
          where: { skillId: { in: task.skills.map((row) => row.skillId) } },
          select: { skillId: true },
        },
        recurringAvailability: {
          where: { isActive: true },
          select: { dayOfWeek: true, startTime: true, endTime: true, isActive: true },
        },
        unavailablePeriods: {
          select: { startDateTime: true, endDateTime: true },
        },
      },
    });
    if (!student) {
      throw studentNotFound();
    }
    if (student.user.role !== UserRole.STUDENT || student.user.verificationStatus !== VerificationStatus.VERIFIED) {
      throw studentNotEligible();
    }
    if (student.skills.length === 0) {
      throw studentNotEligible();
    }

    const preferredEndAt = new Date(
      task.preferredStartAt.getTime() + task.estimatedDurationMinutes * 60 * 1000,
    );
    const available = isAvailableFromSnapshot(
      {
        timezone: student.timezone,
        recurringAvailability: student.recurringAvailability,
        unavailablePeriods: student.unavailablePeriods,
      },
      task.preferredStartAt,
      preferredEndAt,
    );
    if (!available) {
      throw studentNotAvailable();
    }

    try {
      const created = await this.deps.prisma.$transaction(async (tx) => {
        const duplicate = await tx.booking.findFirst({
          where: {
            taskId: task.id,
            studentProfileId: student.id,
            status: { in: ACTIVE_BOOKING_STATUSES },
          },
          select: { id: true },
        });
        if (duplicate) {
          throw bookingRequestAlreadyExists();
        }

        const booking = await tx.booking.create({
          data: {
            taskId: task.id,
            studentProfileId: student.id,
            helpSeekerProfileId: seeker.id,
            status: BookingStatus.PENDING,
            statusHistory: {
              create: {
                fromStatus: null,
                toStatus: BookingStatus.PENDING,
                changedByUserId: userId,
              },
            },
          },
          select: { id: true },
        });

        return tx.booking.findUniqueOrThrow({
          where: { id: booking.id },
          select: bookingSelect,
        });
      });
      return this.toView(created, 'HELP_SEEKER');
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      if (isUniqueConstraintError(error)) {
        throw bookingRequestAlreadyExists();
      }
      throw bookingCreationFailed();
    }
  }

  async getById(userId: string, bookingId: string): Promise<BookingView> {
    const booking = await this.deps.prisma.booking.findUnique({
      where: { id: bookingId },
      select: bookingSelect,
    });
    if (!booking) {
      throw bookingNotFound();
    }

    const [seeker, student] = await Promise.all([
      this.deps.prisma.helpSeekerProfile.findUnique({
        where: { userId },
        select: { id: true },
      }),
      this.deps.prisma.studentProfile.findUnique({
        where: { userId },
        select: { id: true },
      }),
    ]);

    const involved =
      seeker?.id === booking.helpSeekerProfileId || student?.id === booking.studentProfileId;
    if (!involved) {
      throw forbidden();
    }

    const audience: ProgressAudience =
      student?.id === booking.studentProfileId ? 'STUDENT' : 'HELP_SEEKER';
    return this.toView(booking, audience);
  }

  async accept(userId: string, bookingId: string): Promise<BookingView> {
    const student = await this.deps.prisma.studentProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        timezone: true,
        recurringAvailability: {
          where: { isActive: true },
          select: { dayOfWeek: true, startTime: true, endTime: true, isActive: true },
        },
        unavailablePeriods: {
          select: { startDateTime: true, endDateTime: true },
        },
      },
    });
    if (!student) {
      throw forbidden();
    }

    try {
      const accepted = await this.deps.prisma.$transaction(async (tx) => {
        const booking = await tx.booking.findUnique({
          where: { id: bookingId },
          select: {
            id: true,
            status: true,
            studentProfileId: true,
            task: {
              select: {
                preferredStartAt: true,
                estimatedDurationMinutes: true,
              },
            },
          },
        });
        if (!booking) {
          throw bookingNotFound();
        }
        if (booking.studentProfileId !== student.id) {
          throw forbidden();
        }
        if (!canAcceptBooking(booking.status)) {
          throw errorForNonPendingAccept(booking.status);
        }

        const requested = bookingInterval(
          booking.task.preferredStartAt,
          booking.task.estimatedDurationMinutes,
        );
        const available = isAvailableFromSnapshot(
          {
            timezone: student.timezone,
            recurringAvailability: student.recurringAvailability,
            unavailablePeriods: student.unavailablePeriods,
          },
          requested.start,
          requested.end,
        );
        if (!available) {
          throw studentNotAvailable('This booking no longer fits your availability.');
        }

        const blocking = await tx.booking.findMany({
          where: {
            studentProfileId: student.id,
            id: { not: booking.id },
            status: { in: OVERLAP_BLOCKING_STATUSES },
          },
          select: {
            task: {
              select: {
                preferredStartAt: true,
                estimatedDurationMinutes: true,
              },
            },
          },
        });
        const conflict = blocking.some((row) =>
          intervalsOverlap(
            requested,
            bookingInterval(row.task.preferredStartAt, row.task.estimatedDurationMinutes),
          ),
        );
        if (conflict) {
          throw bookingConflict();
        }

        const updated = await tx.booking.updateMany({
          where: { id: booking.id, status: BookingStatus.PENDING },
          data: { status: BookingStatus.ACCEPTED },
        });
        if (updated.count !== 1) {
          const current = await tx.booking.findUnique({
            where: { id: booking.id },
            select: { status: true },
          });
          throw errorForNonPendingAccept(current?.status ?? BookingStatus.CANCELLED);
        }

        const afterUpdate = await tx.booking.findMany({
          where: {
            studentProfileId: student.id,
            id: { not: booking.id },
            status: { in: OVERLAP_BLOCKING_STATUSES },
          },
          select: {
            task: {
              select: {
                preferredStartAt: true,
                estimatedDurationMinutes: true,
              },
            },
          },
        });
        const raced = afterUpdate.some((row) =>
          intervalsOverlap(
            requested,
            bookingInterval(row.task.preferredStartAt, row.task.estimatedDurationMinutes),
          ),
        );
        if (raced) {
          throw bookingConflict();
        }

        await tx.bookingStatusHistory.create({
          data: {
            bookingId: booking.id,
            fromStatus: BookingStatus.PENDING,
            toStatus: BookingStatus.ACCEPTED,
            changedByUserId: userId,
          },
        });

        return tx.booking.findUniqueOrThrow({
          where: { id: booking.id },
          select: bookingSelect,
        });
      });
      return this.toView(accepted, 'STUDENT');
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw bookingCreationFailed();
    }
  }

  async reject(userId: string, bookingId: string, reason: string): Promise<BookingView> {
    const student = await this.deps.prisma.studentProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!student) {
      throw forbidden();
    }

    try {
      const rejected = await this.deps.prisma.$transaction(async (tx) => {
        const booking = await tx.booking.findUnique({
          where: { id: bookingId },
          select: {
            id: true,
            status: true,
            studentProfileId: true,
          },
        });
        if (!booking) {
          throw bookingNotFound();
        }
        if (booking.studentProfileId !== student.id) {
          throw forbidden();
        }
        if (!canRejectBooking(booking.status)) {
          throw errorForNonPendingAccept(booking.status);
        }

        const rejectedAt = new Date();
        const updated = await tx.booking.updateMany({
          where: { id: booking.id, status: BookingStatus.PENDING },
          data: {
            status: BookingStatus.REJECTED,
            rejectionReason: reason,
            rejectedAt,
          },
        });
        if (updated.count !== 1) {
          const current = await tx.booking.findUnique({
            where: { id: booking.id },
            select: { status: true },
          });
          throw errorForNonPendingAccept(current?.status ?? BookingStatus.CANCELLED);
        }

        await tx.bookingStatusHistory.create({
          data: {
            bookingId: booking.id,
            fromStatus: BookingStatus.PENDING,
            toStatus: BookingStatus.REJECTED,
            changedByUserId: userId,
          },
        });

        return tx.booking.findUniqueOrThrow({
          where: { id: booking.id },
          select: bookingSelect,
        });
      });
      return this.toView(rejected, 'STUDENT');
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw bookingUpdateFailed();
    }
  }

  private toView(
    booking: {
      id: string;
      status: BookingStatus;
      createdAt: Date;
      updatedAt: Date;
      startedAt: Date | null;
      submittedForSignoffAt: Date | null;
      completedAt: Date | null;
      rejectionReason: string | null;
      rejectedAt: Date | null;
      statusHistory: Array<{ toStatus: BookingStatus; createdAt: Date }>;
      studentProfile: {
        id: string;
        user: { verificationStatus: VerificationStatus; role: UserRole };
      };
      task: {
        id: string;
        title: string;
        description: string;
        locationLine: string;
        timezone: string;
        preferredStartAt: Date;
        estimatedDurationMinutes: number;
        specialInstructions: string | null;
        status: TaskStatus;
        skills: Array<{ skill: { id: string; name: string; category: string } }>;
      };
    },
    audience: ProgressAudience,
  ): BookingView {
    const local = utcToZonedParts(booking.task.preferredStartAt, booking.task.timezone);
    const createdAt = booking.createdAt.toISOString();
    const updatedAt = booking.updatedAt.toISOString();
    const rejectedAt = booking.rejectedAt ? booking.rejectedAt.toISOString() : null;
    const statusHistory = booking.statusHistory.map((event) => ({
      status: event.toStatus,
      createdAt: event.createdAt.toISOString(),
    }));
    return {
      id: booking.id,
      status: booking.status,
      createdAt,
      updatedAt,
      startedAt: booking.startedAt ? booking.startedAt.toISOString() : null,
      submittedForSignoffAt: booking.submittedForSignoffAt
        ? booking.submittedForSignoffAt.toISOString()
        : null,
      completedAt: booking.completedAt ? booking.completedAt.toISOString() : null,
      rejectionReason: booking.rejectionReason,
      rejectedAt,
      statusHistory,
      progress: buildBookingProgress({
        status: booking.status,
        createdAt,
        updatedAt,
        rejectedAt,
        statusHistory,
        audience,
      }),
      student: {
        id: booking.studentProfile.id,
        verificationStatus: booking.studentProfile.user.verificationStatus,
      },
      task: {
        id: booking.task.id,
        title: booking.task.title,
        description: booking.task.description,
        skills: booking.task.skills.map((row) => row.skill),
        location: { addressLine: booking.task.locationLine },
        timezone: booking.task.timezone,
        preferredDate: local.date,
        preferredTime: `${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')}`,
        preferredStartAt: booking.task.preferredStartAt.toISOString(),
        estimatedDurationMinutes: booking.task.estimatedDurationMinutes,
        specialInstructions: booking.task.specialInstructions,
        status: booking.task.status,
      },
    };
  }
}
