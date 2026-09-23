import type { PrismaClient } from '@prisma/client';
import {
  forbidden,
  invalidDateRange,
  unavailablePeriodNotFound,
  unavailablePeriodOverlap,
  validationError,
} from '../../shared/errors.js';
import {
  DAYS_OF_WEEK,
  compareIsoDates,
  inclusiveDatesFromRange,
  isIntervalCoveredByWeeklySlots,
  rangesOverlap,
  unavailableRangeFromDates,
  zonedCalendarDate,
} from './availability.time.js';
import type {
  AvailabilitySnapshot,
  AvailabilityView,
  ReplaceWeeklyAvailabilityInput,
  UnavailablePeriodInput,
  UnavailablePeriodView,
  WeeklySlotView,
} from './availability.types.js';

type AvailabilityServiceDeps = {
  prisma: PrismaClient;
};

export class AvailabilityService {
  constructor(private readonly deps: AvailabilityServiceDeps) {}

  async getMine(userId: string): Promise<AvailabilityView> {
    const profile = await this.requireProfile(userId);
    return this.readAvailability(profile.id, profile.timezone);
  }

  async replaceWeekly(userId: string, input: ReplaceWeeklyAvailabilityInput): Promise<AvailabilityView> {
    const profile = await this.requireProfile(userId);
    const rows = input.days.flatMap((day) =>
      day.slots.map((slot) => ({
        studentProfileId: profile.id,
        dayOfWeek: day.dayOfWeek,
        startTime: slot.start,
        endTime: slot.end,
        isActive: true,
      })),
    );

    await this.deps.prisma.$transaction(async (tx) => {
      await tx.studentProfile.update({
        where: { id: profile.id },
        data: { timezone: input.timezone },
      });
      await tx.recurringAvailability.deleteMany({
        where: { studentProfileId: profile.id },
      });
      if (rows.length > 0) {
        await tx.recurringAvailability.createMany({ data: rows });
      }
    });

    return this.readAvailability(profile.id, input.timezone);
  }

  async addUnavailable(userId: string, input: UnavailablePeriodInput): Promise<UnavailablePeriodView> {
    const profile = await this.requireProfile(userId);
    const timeZone = this.requireTimezone(profile.timezone);
    this.assertNotInThePast(input.endDate, timeZone);
    const range = unavailableRangeFromDates(timeZone, input.startDate, input.endDate);
    await this.assertNoUnavailableOverlap(profile.id, range.startDateTime, range.endDateTime);

    const created = await this.deps.prisma.unavailablePeriod.create({
      data: {
        studentProfileId: profile.id,
        startDateTime: range.startDateTime,
        endDateTime: range.endDateTime,
        reason: input.reason,
      },
    });

    return this.toUnavailableView(created, timeZone);
  }

  async updateUnavailable(
    userId: string,
    periodId: string,
    input: UnavailablePeriodInput,
  ): Promise<UnavailablePeriodView> {
    const profile = await this.requireProfile(userId);
    const timeZone = this.requireTimezone(profile.timezone);
    const existing = await this.requireOwnedUnavailable(profile.id, periodId);
    this.assertNotInThePast(input.endDate, timeZone);
    const range = unavailableRangeFromDates(timeZone, input.startDate, input.endDate);
    await this.assertNoUnavailableOverlap(
      profile.id,
      range.startDateTime,
      range.endDateTime,
      existing.id,
    );

    const updated = await this.deps.prisma.unavailablePeriod.update({
      where: { id: existing.id },
      data: {
        startDateTime: range.startDateTime,
        endDateTime: range.endDateTime,
        reason: input.reason,
      },
    });

    return this.toUnavailableView(updated, timeZone);
  }

  async removeUnavailable(userId: string, periodId: string): Promise<void> {
    const profile = await this.requireProfile(userId);
    const existing = await this.requireOwnedUnavailable(profile.id, periodId);
    await this.deps.prisma.unavailablePeriod.delete({
      where: { id: existing.id },
    });
  }

  async isAvailable(userId: string, start: Date, end: Date): Promise<boolean> {
    const profile = await this.deps.prisma.studentProfile.findUnique({
      where: { userId },
      select: {
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
    if (!profile) {
      return false;
    }
    return isAvailableFromSnapshot(profile, start, end);
  }

  private async readAvailability(
    studentProfileId: string,
    timezone: string | null,
  ): Promise<AvailabilityView> {
    const [weeklyRows, unavailableRows] = await Promise.all([
      this.deps.prisma.recurringAvailability.findMany({
        where: { studentProfileId, isActive: true },
        orderBy: { startTime: 'asc' },
      }),
      this.deps.prisma.unavailablePeriod.findMany({
        where: { studentProfileId },
        orderBy: { startDateTime: 'asc' },
      }),
    ]);

    const weekly: WeeklySlotView[] = weeklyRows
      .map((row) => ({
        id: row.id,
        dayOfWeek: row.dayOfWeek,
        startTime: row.startTime,
        endTime: row.endTime,
      }))
      .sort((left, right) => {
        const dayDelta =
          DAYS_OF_WEEK.indexOf(left.dayOfWeek) - DAYS_OF_WEEK.indexOf(right.dayOfWeek);
        return dayDelta !== 0 ? dayDelta : left.startTime.localeCompare(right.startTime);
      });

    const unavailable = timezone
      ? unavailableRows.map((row) => this.toUnavailableView(row, timezone))
      : unavailableRows.map((row) => ({
          id: row.id,
          startDate: row.startDateTime.toISOString().slice(0, 10),
          endDate: row.endDateTime.toISOString().slice(0, 10),
          startDateTime: row.startDateTime.toISOString(),
          endDateTime: row.endDateTime.toISOString(),
          reason: row.reason,
        }));

    return { timezone, weekly, unavailable };
  }

  private toUnavailableView(
    row: { id: string; startDateTime: Date; endDateTime: Date; reason: string | null },
    timeZone: string,
  ): UnavailablePeriodView {
    const dates = inclusiveDatesFromRange(timeZone, row.startDateTime, row.endDateTime);
    return {
      id: row.id,
      startDate: dates.startDate,
      endDate: dates.endDate,
      startDateTime: row.startDateTime.toISOString(),
      endDateTime: row.endDateTime.toISOString(),
      reason: row.reason,
    };
  }

  private assertNotInThePast(endDate: string, timeZone: string, now = new Date()): void {
    const today = zonedCalendarDate(now, timeZone);
    if (compareIsoDates(endDate, today) < 0) {
      throw invalidDateRange('Unavailable periods cannot end in the past.');
    }
  }

  private async assertNoUnavailableOverlap(
    studentProfileId: string,
    startDateTime: Date,
    endDateTime: Date,
    ignoreId?: string,
  ): Promise<void> {
    const existing = await this.deps.prisma.unavailablePeriod.findMany({
      where: { studentProfileId, ...(ignoreId ? { id: { not: ignoreId } } : {}) },
      select: { startDateTime: true, endDateTime: true },
    });
    const overlaps = existing.some((period) =>
      rangesOverlap(startDateTime, endDateTime, period.startDateTime, period.endDateTime),
    );
    if (overlaps) {
      throw unavailablePeriodOverlap();
    }
  }

  private requireTimezone(timezone: string | null): string {
    if (!timezone) {
      throw validationError('Save your weekly availability and timezone before adding unavailable dates.', [
        { field: 'timezone', message: 'Save your weekly availability and timezone before adding unavailable dates.' },
      ]);
    }
    return timezone;
  }

  private async requireOwnedUnavailable(studentProfileId: string, periodId: string) {
    const record = await this.deps.prisma.unavailablePeriod.findUnique({
      where: { id: periodId },
      select: { id: true, studentProfileId: true, startDateTime: true, endDateTime: true, reason: true },
    });
    if (!record) {
      throw unavailablePeriodNotFound();
    }
    if (record.studentProfileId !== studentProfileId) {
      throw forbidden();
    }
    return record;
  }

  private async requireProfile(userId: string) {
    const existing = await this.deps.prisma.studentProfile.findUnique({
      where: { userId },
      select: { id: true, timezone: true },
    });
    if (existing) {
      return existing;
    }
    return this.deps.prisma.studentProfile.create({
      data: { userId },
      select: { id: true, timezone: true },
    });
  }
}

export function isAvailableFromSnapshot(profile: AvailabilitySnapshot, start: Date, end: Date): boolean {
  if (end.getTime() <= start.getTime()) {
    return false;
  }
  if (!profile.timezone) {
    return false;
  }

  const blocked = profile.unavailablePeriods.some((period) =>
    rangesOverlap(start, end, period.startDateTime, period.endDateTime),
  );
  if (blocked) {
    return false;
  }

  return isIntervalCoveredByWeeklySlots(profile.timezone, start, end, profile.recurringAvailability);
}
