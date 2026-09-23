import { DayOfWeek } from '@prisma/client';

export type WeeklySlotInput = {
  start: string;
  end: string;
};

export type WeeklyDayInput = {
  dayOfWeek: DayOfWeek;
  slots: WeeklySlotInput[];
};

export type ReplaceWeeklyAvailabilityInput = {
  timezone: string;
  days: WeeklyDayInput[];
};

export type UnavailablePeriodInput = {
  startDate: string;
  endDate: string;
  reason: string | null;
};

export type WeeklySlotView = {
  id: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
};

export type UnavailablePeriodView = {
  id: string;
  startDate: string;
  endDate: string;
  startDateTime: string;
  endDateTime: string;
  reason: string | null;
};

export type AvailabilityView = {
  timezone: string | null;
  weekly: WeeklySlotView[];
  unavailable: UnavailablePeriodView[];
};

export type AvailabilitySnapshot = {
  timezone: string | null;
  recurringAvailability: Array<{
    dayOfWeek: DayOfWeek;
    startTime: string;
    endTime: string;
    isActive?: boolean;
  }>;
  unavailablePeriods: Array<{
    startDateTime: Date;
    endDateTime: Date;
  }>;
};
