/**
 * Clock stepping for the Animate Chart page, mirroring KP-Qt's
 * `AnimateChartDialog::stepTime(from, value, type)`: seconds/minutes/hours/days step by elapsed
 * time, months/years step calendar-wise and clamp the day to the target month's last day
 * (matching `QDateTime::addMonths`/`addYears`, e.g. Jan 31 + 1 month -> Feb 28/29).
 */

export type IncrementType = 'seconds' | 'minutes' | 'hours' | 'days' | 'months' | 'years';

export interface SimpleDateTime {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const ELAPSED_SECONDS_PER_UNIT: Record<'seconds' | 'minutes' | 'hours' | 'days', number> = {
  seconds: 1,
  minutes: 60,
  hours: 3600,
  days: 86400,
};

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function stepTime(from: SimpleDateTime, amount: number, type: IncrementType): SimpleDateTime {
  if (type === 'months' || type === 'years') {
    const totalMonths = type === 'years' ? amount * 12 : amount;
    const base = from.month - 1 + totalMonths;
    const year = from.year + Math.floor(base / 12);
    const month = ((base % 12) + 12) % 12 + 1;
    const day = Math.min(from.day, daysInMonth(year, month));
    return { year, month, day, hour: from.hour, minute: from.minute, second: from.second };
  }

  const fromMs = Date.UTC(from.year, from.month - 1, from.day, from.hour, from.minute, from.second);
  const steppedMs = fromMs + amount * ELAPSED_SECONDS_PER_UNIT[type] * 1000;
  const d = new Date(steppedMs);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
  };
}
