export const DAYS_OF_WEEK = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;

export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

export const DAY_LABELS: Record<DayOfWeek, string> = {
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday',
  SUNDAY: 'Sunday',
};

export const COMMON_TIMEZONES = [
  'Europe/Berlin',
  'Europe/Stockholm',
  'Europe/Amsterdam',
  'Europe/Vienna',
  'Europe/Paris',
  'Europe/London',
  'UTC',
] as const;

export type TimeSlot = {
  start: string;
  end: string;
};

export type WeeklyDayState = {
  enabled: boolean;
  slots: TimeSlot[];
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

export type AvailabilityResponse = {
  timezone: string | null;
  weekly: WeeklySlotView[];
  unavailable: UnavailablePeriodView[];
};

export type ReplaceWeeklyInput = {
  timezone: string;
  days: Array<{
    dayOfWeek: DayOfWeek;
    slots: TimeSlot[];
  }>;
};

export type UnavailablePeriodInput = {
  startDate: string;
  endDate: string;
  reason: string;
};
