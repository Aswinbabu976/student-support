import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, userFacingAuthMessage } from '../../../services/api/client';
import { unavailablePeriodSchema, validateWeeklySchedule } from '../schemas/availability';
import type { WeeklyFieldErrors } from '../schemas/availability';
import {
  createUnavailablePeriod,
  deleteUnavailablePeriod,
  getAvailability,
  saveWeeklyAvailability,
} from '../services/availability-api';
import {
  COMMON_TIMEZONES,
  DAYS_OF_WEEK,
  type DayOfWeek,
  type UnavailablePeriodView,
  type WeeklyDayState,
} from '../types';

function emptyDays(): Record<DayOfWeek, WeeklyDayState> {
  return {
    MONDAY: { enabled: false, slots: [] },
    TUESDAY: { enabled: false, slots: [] },
    WEDNESDAY: { enabled: false, slots: [] },
    THURSDAY: { enabled: false, slots: [] },
    FRIDAY: { enabled: false, slots: [] },
    SATURDAY: { enabled: false, slots: [] },
    SUNDAY: { enabled: false, slots: [] },
  };
}

function normalizeClock(value: string): string {
  const match = /^([01]\d|2[0-3]):([0-5]\d)/.exec(value.trim());
  return match ? `${match[1]}:${match[2]}` : value.trim();
}

type VacationForm = {
  startDate: string;
  endDate: string;
  reason: string;
};

const emptyVacation: VacationForm = { startDate: '', endDate: '', reason: '' };

export function useStudentAvailability() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [timezone, setTimezone] = useState('');
  const [days, setDays] = useState<Record<DayOfWeek, WeeklyDayState>>(emptyDays);
  const [unavailable, setUnavailable] = useState<UnavailablePeriodView[]>([]);
  const [weeklyErrors, setWeeklyErrors] = useState<WeeklyFieldErrors>({});
  const [weeklySubmitting, setWeeklySubmitting] = useState(false);
  const [weeklyFormError, setWeeklyFormError] = useState<string | null>(null);
  const [vacation, setVacation] = useState<VacationForm>(emptyVacation);
  const [vacationErrors, setVacationErrors] = useState<Partial<VacationForm>>({});
  const [vacationFormError, setVacationFormError] = useState<string | null>(null);
  const [vacationSubmitting, setVacationSubmitting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<UnavailablePeriodView | null>(null);
  const [deleting, setDeleting] = useState(false);

  const timezoneOptions = useMemo(() => {
    const browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return [...new Set([...COMMON_TIMEZONES, timezone, browser].filter(Boolean))].sort((a, b) =>
      a.localeCompare(b),
    );
  }, [timezone]);

  const hasAvailability = DAYS_OF_WEEK.some((day) => days[day].enabled && days[day].slots.length > 0);
  const isEmpty = !loading && !hasAvailability && unavailable.length === 0 && !showEditor;

  useEffect(() => {
    let cancelled = false;
    getAvailability()
      .then((response) => {
        if (cancelled) {
          return;
        }
        const nextDays = emptyDays();
        for (const slot of response.weekly) {
          nextDays[slot.dayOfWeek].enabled = true;
          nextDays[slot.dayOfWeek].slots.push({ start: slot.startTime, end: slot.endTime });
        }
        setDays(nextDays);
        setUnavailable(response.unavailable);
        setTimezone(response.timezone ?? '');
        setShowEditor(response.weekly.length > 0 || response.unavailable.length > 0);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        if (error instanceof ApiError && error.status === 401) {
          navigate('/login', { replace: true });
          return;
        }
        if (error instanceof ApiError && error.status === 403) {
          navigate('/', { replace: true });
          return;
        }
        setLoadError('Your availability could not be loaded. Try again.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  function startEditing() {
    setShowEditor(true);
    setSuccessMessage(null);
  }

  function setDayEnabled(day: DayOfWeek, enabled: boolean) {
    setDays((current) => ({
      ...current,
      [day]: enabled
        ? {
            enabled: true,
            slots: current[day].slots.length ? current[day].slots : [{ start: '', end: '' }],
          }
        : { enabled: false, slots: [] },
    }));
    setWeeklyErrors({});
    setWeeklyFormError(null);
  }

  function addSlot(day: DayOfWeek) {
    setDays((current) => ({
      ...current,
      [day]: { enabled: true, slots: [...current[day].slots, { start: '', end: '' }] },
    }));
  }

  function updateSlot(day: DayOfWeek, index: number, patch: Partial<{ start: string; end: string }>) {
    setDays((current) => ({
      ...current,
      [day]: {
        ...current[day],
        slots: current[day].slots.map((slot, slotIndex) =>
          slotIndex === index ? { ...slot, ...patch } : slot,
        ),
      },
    }));
    setWeeklyErrors({});
    setWeeklyFormError(null);
  }

  function removeSlot(day: DayOfWeek, index: number) {
    setDays((current) => {
      const slots = current[day].slots.filter((_, slotIndex) => slotIndex !== index);
      return {
        ...current,
        [day]: {
          enabled: slots.length > 0,
          slots,
        },
      };
    });
  }

  async function submitWeekly() {
    if (weeklySubmitting) {
      return;
    }
    const errors = validateWeeklySchedule(timezone, days);
    if (errors.timezone || (errors.days && Object.keys(errors.days).length) || (errors.slots && Object.keys(errors.slots).length)) {
      setWeeklyErrors(errors);
      setWeeklyFormError(null);
      return;
    }
    setWeeklySubmitting(true);
    setWeeklyFormError(null);
    try {
      const response = await saveWeeklyAvailability({
        timezone,
        days: DAYS_OF_WEEK.filter((day) => days[day].enabled).map((day) => ({
          dayOfWeek: day,
          slots: days[day].slots.map((slot) => ({
            start: normalizeClock(slot.start),
            end: normalizeClock(slot.end),
          })),
        })),
      });
      const nextDays = emptyDays();
      for (const slot of response.weekly) {
        nextDays[slot.dayOfWeek].enabled = true;
        nextDays[slot.dayOfWeek].slots.push({ start: slot.startTime, end: slot.endTime });
      }
      setDays(nextDays);
      setTimezone(response.timezone ?? timezone);
      setUnavailable(response.unavailable);
      setWeeklySubmitting(false);
      setSuccessMessage('Weekly availability saved.');
    } catch (error) {
      setWeeklySubmitting(false);
      setWeeklyFormError(userFacingAuthMessage(error));
    }
  }

  function patchVacation(patch: Partial<VacationForm>) {
    setVacation((current) => ({ ...current, ...patch }));
    setVacationErrors({});
    setVacationFormError(null);
  }

  async function submitVacation() {
    if (vacationSubmitting) {
      return;
    }
    const parsed = unavailablePeriodSchema.safeParse(vacation);
    if (!parsed.success) {
      const next: Partial<VacationForm> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === 'startDate' || field === 'endDate' || field === 'reason') {
          next[field] ??= issue.message;
        }
      }
      setVacationErrors(next);
      return;
    }
    if (!timezone) {
      setVacationFormError('Save your weekly availability and timezone before adding unavailable dates.');
      return;
    }
    setVacationSubmitting(true);
    try {
      const response = await createUnavailablePeriod(parsed.data);
      setUnavailable((current) => [...current, response.period]);
      setVacation(emptyVacation);
      setVacationSubmitting(false);
      setSuccessMessage('Unavailable period added.');
      setShowEditor(true);
    } catch (error) {
      setVacationSubmitting(false);
      if (error instanceof ApiError) {
        const start = error.fieldMessage('startDate');
        const end = error.fieldMessage('endDate');
        if (start || end) {
          setVacationErrors({
            startDate: start,
            endDate: end,
          });
          setVacationFormError(null);
          return;
        }
      }
      setVacationFormError(userFacingAuthMessage(error));
    }
  }

  async function confirmDelete() {
    if (!pendingDelete || deleting) {
      return;
    }
    setDeleting(true);
    try {
      await deleteUnavailablePeriod(pendingDelete.id);
      setUnavailable((current) => current.filter((period) => period.id !== pendingDelete.id));
      setPendingDelete(null);
      setDeleting(false);
      setSuccessMessage('Unavailable period removed.');
    } catch (error) {
      setDeleting(false);
      setPendingDelete(null);
      setLoadError(userFacingAuthMessage(error));
    }
  }

  return {
    loading,
    loadError,
    successMessage,
    isEmpty,
    timezone,
    timezoneOptions,
    days,
    unavailable,
    weeklyErrors,
    weeklySubmitting,
    weeklyFormError,
    vacation,
    vacationErrors,
    vacationFormError,
    vacationSubmitting,
    pendingDelete,
    deleting,
    setTimezone: (value: string) => {
      setTimezone(value);
      setWeeklyErrors({});
      setWeeklyFormError(null);
    },
    startEditing,
    setDayEnabled,
    addSlot,
    updateSlot,
    removeSlot,
    submitWeekly,
    patchVacation,
    submitVacation,
    requestDelete: setPendingDelete,
    cancelDelete: () => {
      if (!deleting) {
        setPendingDelete(null);
      }
    },
    confirmDelete,
  };
}
