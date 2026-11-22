import { TimezoneOffsetResult } from './types';

/**
 * Validates if an IANA timezone identifier is recognized by the runtime.
 */
export function isValidTimezone(timeZone: string): boolean {
  if (!timeZone || typeof timeZone !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Formats offset in minutes into a standard string like "UTC+05:30" or "UTC-05:00".
 */
export function formatOffsetMinutes(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absMin = Math.abs(offsetMinutes);
  const h = String(Math.floor(absMin / 60)).padStart(2, '0');
  const m = String(absMin % 60).padStart(2, '0');
  return `UTC${sign}${h}:${m}`;
}

/**
 * Checks if Daylight Saving Time (DST) is active for the given year and offset in this timezone.
 */
export function isDstActive(year: number, offsetMinutes: number, timeZone: string): boolean {
  function getOffsetForUtc(d: Date): number {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hourCycle: 'h23',
    });
    const parts = dtf.formatToParts(d);
    const map: Record<string, number> = {};
    for (const p of parts) {
      if (p.type !== 'literal') {
        map[p.type] = parseInt(p.value, 10);
      }
    }
    const asTarget = Date.UTC(map.year, map.month - 1, map.day, map.hour, map.minute, map.second);
    return Math.round((asTarget - d.getTime()) / 60000);
  }

  try {
    const janOffset = getOffsetForUtc(new Date(Date.UTC(year, 0, 15, 12, 0, 0)));
    const julOffset = getOffsetForUtc(new Date(Date.UTC(year, 6, 15, 12, 0, 0)));

    if (janOffset === julOffset) {
      return false;
    }
    const stdOffset = Math.min(janOffset, julOffset);
    return offsetMinutes > stdOffset;
  } catch {
    return false;
  }
}

/** What to do when a local clock time occurs twice (a fall-back overlap). */
export type AmbiguousTimeChoice = 'earlier' | 'later' | 'reject';

export interface ComputeTimezoneOptions {
  /**
   * `'earlier'`: the first occurrence (before the clocks went back, the larger UTC offset).
   * `'later'`: the second occurrence (after the clocks went back, the smaller UTC offset).
   * `'reject'`: throw `AmbiguousLocalTimeError`.
   * Default `'earlier'` with an "Ambiguous local time" warning in the result (the behaviour before
   * `locations-select`). The API passes `'reject'` unless the caller chose, so it never picks silently.
   */
  ambiguous?: AmbiguousTimeChoice;
}

/** The local time falls in a gap: the clocks skipped it. */
export class NonexistentLocalTimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NonexistentLocalTimeError';
  }
}

/** The local time occurs twice and no choice was given. `offsetsMinutes` is [earlier, later]. */
export class AmbiguousLocalTimeError extends Error {
  readonly offsetsMinutes: [number, number];
  constructor(message: string, offsetsMinutes: [number, number]) {
    super(message);
    this.name = 'AmbiguousLocalTimeError';
    this.offsetsMinutes = offsetsMinutes;
  }
}

/** Milliseconds since the epoch of a UTC civil date-time; years 0-99 are not read as 1900-1999. */
function utcMs(year: number, month: number, day: number, hours: number, minutes: number, seconds: number): number {
  const d = new Date(0);
  d.setUTCFullYear(year, month - 1, day);
  d.setUTCHours(hours, minutes, seconds, 0);
  return d.getTime();
}

/**
 * Computes exact UTC date and offset for local date and time in an IANA timezone, from the zone's rules at
 * that date (historical offsets, DST, zone changes), never the zone's current offset.
 *
 * A local time inside a gap throws `NonexistentLocalTimeError`. A local time that occurs twice follows
 * `options.ambiguous`. The offset is exact to the second (`offsetSeconds`); `offsetMinutes` is rounded.
 */
export function computeTimezoneOffset(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
  seconds: number,
  timeZone: string,
  options: ComputeTimezoneOptions = {}
): TimezoneOffsetResult {
  if (!isValidTimezone(timeZone)) {
    throw new Error(`Invalid or unsupported IANA timezone identifier: "${timeZone}"`);
  }

  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  });

  /** The zone's UTC offset in seconds at the UTC instant `ms` (whole seconds). */
  function offsetSecondsAt(ms: number): number {
    const whole = Math.floor(ms / 1000) * 1000;
    const map: Record<string, number> = {};
    for (const p of dtf.formatToParts(new Date(whole))) {
      if (p.type !== 'literal') map[p.type] = parseInt(p.value, 10);
    }
    const asLocal = utcMs(map.year, map.month, map.day, map.hour, map.minute, map.second);
    return Math.round((asLocal - whole) / 1000);
  }

  const localAsUtc = utcMs(year, month, day, hours, minutes, seconds);
  const DAY = 86400000;

  // The offsets in force a day before and a day after the wall-clock time. A UTC instant `localAsUtc - o`
  // is a valid reading of the wall clock only if the zone's offset at that instant is `o`.
  const before = offsetSecondsAt(localAsUtc - DAY);
  const after = offsetSecondsAt(localAsUtc + DAY);
  const valid = [...new Set([before, after])]
    .filter((o) => offsetSecondsAt(localAsUtc - o * 1000) === o)
    .sort((a, b) => b - a);

  const pad = (n: number) => String(n).padStart(2, '0');
  const localDateTimeString = `${year}-${pad(month)}-${pad(day)} ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  const fmt = (offsetSec: number) => formatOffsetMinutes(Math.round(offsetSec / 60));

  if (valid.length === 0) {
    throw new NonexistentLocalTimeError(
      `The local time ${localDateTimeString} does not exist in timezone "${timeZone}" due to a daylight saving time spring-forward transition ` +
        `(the clocks skipped from ${fmt(before)} to ${fmt(after)}).`
    );
  }

  const warnings: string[] = [];
  let offsetSeconds = valid[0]; // the earlier occurrence has the larger offset
  if (valid.length > 1) {
    const earlier = valid[0];
    const later = valid[valid.length - 1];
    const choice = options.ambiguous ?? 'earlier';
    if (choice === 'reject') {
      throw new AmbiguousLocalTimeError(
        `Ambiguous local time: ${localDateTimeString} occurs twice in timezone "${timeZone}" ` +
          `(${fmt(earlier)} before the clocks went back, ${fmt(later)} after). Choose "earlier" or "later".`,
        [Math.round(earlier / 60), Math.round(later / 60)]
      );
    }
    offsetSeconds = choice === 'later' ? later : earlier;
    warnings.push(
      options.ambiguous === undefined
        ? `Ambiguous local time: This wall-clock time occurs twice in timezone "${timeZone}" due to a daylight saving fall-back transition. The earlier occurrence (${fmt(earlier)}) was used.`
        : `Ambiguous local time: This wall-clock time occurs twice in timezone "${timeZone}"; the ${choice} occurrence (${fmt(offsetSeconds)}) was used, as chosen.`
    );
  }

  const offsetMinutes = Math.round(offsetSeconds / 60);
  const offsetString = formatOffsetMinutes(offsetMinutes);
  const isDst = isDstActive(year, offsetMinutes, timeZone);
  const utcDate = new Date(localAsUtc - offsetSeconds * 1000);

  if (year < 1970) {
    warnings.push(
      'Notice: Birth year is before 1970. IANA tzdb data before 1970 may contain historical approximations.'
    );
  }

  return {
    timezone: timeZone,
    localDateTimeString,
    utcDateTimeString: utcDate.toISOString(),
    utcDate: utcDate.toISOString(),
    offsetMinutes,
    offsetSeconds,
    offsetString,
    isDst,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
