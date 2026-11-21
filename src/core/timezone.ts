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

/**
 * Computes exact UTC date and offset for local date and time in an IANA timezone.
 */
export function computeTimezoneOffset(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
  seconds: number,
  timeZone: string
): TimezoneOffsetResult {
  if (!isValidTimezone(timeZone)) {
    throw new Error(`Invalid or unsupported IANA timezone identifier: "${timeZone}"`);
  }

  // Iteratively converge from local wall clock time to UTC
  let utcGuess = Date.UTC(year, month - 1, day, hours, minutes, seconds);

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

  function getParts(d: number): number {
    const parts = dtf.formatToParts(new Date(d));
    const map: Record<string, number> = {};
    for (const p of parts) {
      if (p.type !== 'literal') {
        map[p.type] = parseInt(p.value, 10);
      }
    }
    return Date.UTC(map.year, map.month - 1, map.day, map.hour, map.minute, map.second);
  }

  for (let i = 0; i < 4; i++) {
    const asTarget = getParts(utcGuess);
    const diff = asTarget - Date.UTC(year, month - 1, day, hours, minutes, seconds);
    if (diff === 0) break;
    utcGuess -= diff;
  }

  // Verify round-trip accuracy to detect nonexistent DST spring-forward times
  const roundTripLocal = getParts(utcGuess);
  const targetLocal = Date.UTC(year, month - 1, day, hours, minutes, seconds);
  if (roundTripLocal !== targetLocal) {
    throw new Error(
      `The local time ${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ` +
      `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} ` +
      `does not exist in timezone "${timeZone}" due to a daylight saving time spring-forward transition.`
    );
  }

  const localUtcRepresentation = Date.UTC(year, month - 1, day, hours, minutes, seconds);
  const offsetMs = localUtcRepresentation - utcGuess;
  const offsetMinutes = Math.round(offsetMs / 60000);
  const offsetSeconds = offsetMinutes * 60;
  const offsetString = formatOffsetMinutes(offsetMinutes);
  const isDst = isDstActive(year, offsetMinutes, timeZone);

  const utcDate = new Date(utcGuess);
  const pad = (n: number) => String(n).padStart(2, '0');
  const localDateTimeString = `${year}-${pad(month)}-${pad(day)} ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  const warnings: string[] = [];

  // Check for ambiguous fall-back time (time occurs twice during DST transition)
  const candidateEarlier = utcGuess - 3600000;
  const candidateLater = utcGuess + 3600000;
  if (getParts(candidateEarlier) === targetLocal || getParts(candidateLater) === targetLocal) {
    warnings.push(
      `Ambiguous local time: This wall-clock time occurs twice in timezone "${timeZone}" due to a daylight saving fall-back transition.`
    );
  }

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
