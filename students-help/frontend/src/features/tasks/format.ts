export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours === 0) {
    return remaining === 1 ? '1 minute' : `${remaining} minutes`;
  }
  if (remaining === 0) {
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }
  const hourLabel = hours === 1 ? '1 hour' : `${hours} hours`;
  const minuteLabel = remaining === 1 ? '1 minute' : `${remaining} minutes`;
  return `${hourLabel} ${minuteLabel}`;
}

export function zonedDateTimeParts(
  instant: Date,
  timeZone: string,
): { date: string; time: string } | null {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    const values: Record<string, string> = {};
    for (const part of formatter.formatToParts(instant)) {
      if (part.type !== 'literal') {
        values[part.type] = part.value;
      }
    }
    if (!values.year || !values.month || !values.day || !values.hour || !values.minute) {
      return null;
    }
    return {
      date: `${values.year}-${values.month}-${values.day}`,
      time: `${values.hour}:${values.minute}`,
    };
  } catch {
    return null;
  }
}

export function isFuturePreferredStart(
  date: string,
  time: string,
  timeZone: string,
  now = new Date(),
): boolean {
  const current = zonedDateTimeParts(now, timeZone);
  if (!current) {
    return false;
  }
  if (date > current.date) {
    return true;
  }
  if (date < current.date) {
    return false;
  }
  return time > current.time;
}

export function clockTimeFromInput(value: string): string {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(value.trim());
  if (!match) {
    return value.trim();
  }
  return `${match[1]}:${match[2]}`;
}

export function parseDurationMinutes(hoursValue: string, minutesValue: string): number | null {
  const hoursText = hoursValue.trim();
  const minutesText = minutesValue.trim();
  if (!hoursText && !minutesText) {
    return null;
  }
  const hours = hoursText === '' ? 0 : Number(hoursText);
  const minutes = minutesText === '' ? 0 : Number(minutesText);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || minutes < 0 || minutes > 59) {
    return Number.NaN;
  }
  return hours * 60 + minutes;
}
