import { computeTimezoneOffset, isValidTimezone } from './timezone';
import { AYANAMSA_LABELS, AYANAMSA_MODES, isAyanamsaMode } from '../engine/ayanamsa-defs';
import { AyanamsaMode, RawBirthInput, ResolvedBirthChartInput, ValidationResult } from './types';

/**
 * Checks if a given year is a leap year in the Gregorian calendar.
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Returns number of days in a given month of a year.
 */
export function getDaysInMonth(year: number, month: number): number {
  switch (month) {
    case 1:
    case 3:
    case 5:
    case 7:
    case 8:
    case 10:
    case 12:
      return 31;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    case 2:
      return isLeapYear(year) ? 29 : 28;
    default:
      return 0;
  }
}

/**
 * Validates date components strictly.
 */
export function validateDate(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || year < 1800 || year > 2200) {
    return 'Year must be a valid integer between 1800 and 2200.';
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return 'Month must be an integer between 1 and 12.';
  }
  const maxDays = getDaysInMonth(year, month);
  if (!Number.isInteger(day) || day < 1 || day > maxDays) {
    return `Day must be between 1 and ${maxDays} for month ${month}, year ${year}.`;
  }
  return null;
}

/**
 * Validates time components strictly, ensuring seconds are provided.
 */
export function validateTime(hours: number, minutes: number, seconds: number): string | null {
  if (!Number.isInteger(hours) || hours < 0 || hours > 23) {
    return 'Hours must be an integer between 0 and 23.';
  }
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 59) {
    return 'Minutes must be an integer between 0 and 59.';
  }
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > 59) {
    return 'Seconds must be an integer between 0 and 59. KP astrology requires time to the second.';
  }
  return null;
}

/**
 * Validates latitude and longitude coordinates.
 */
export function validateCoordinates(lat: number, lon: number): string | null {
  if (typeof lat !== 'number' || Number.isNaN(lat) || lat < -90 || lat > 90) {
    return 'Latitude must be a valid number between -90 and +90 degrees.';
  }
  if (typeof lon !== 'number' || Number.isNaN(lon) || lon < -180 || lon > 180) {
    return 'Longitude must be a valid number between -180 and +180 degrees.';
  }
  return null;
}

/**
 * Validates ayanamsa selection.
 * The ayanamsa must be one of the supported ids (owner decision on #29, plus KP Straight Line and
 * KP Ayanamsa from KP-Qt): KP Straight Line (Adjusted), KP Straight Line, KP Ayanamsa, KP Old,
 * KP New, Lahiri, Raman, Fagan-Bradley, Yukteshwar, J.N. Bhasin, Usha-Shashi, Nil. #22 decided
 * (owner, #29): KP New is the UI's default selection; the API requires an explicit ayanamsa:
 * anything else, including a missing value, is an error.
 */
export function validateAyanamsa(ayanamsa: unknown): string | null {
  if (!isAyanamsaMode(ayanamsa)) {
    const choices = AYANAMSA_MODES.map((m) => `${AYANAMSA_LABELS[m]} ('${m}')`).join(', ');
    return `Ayanamsa must be explicitly selected as one of: ${choices}. Every request must name its ayanamsa; there is no silent fallback (the API never falls back, and 'defaultSelection' is only the UI's preselected option).`;
  }
  return null;
}

export interface BirthInputPayload {
  date?: string;
  year?: number;
  month?: number;
  day?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
  placeText?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  country?: string;
  countryCode?: string;
  ayanamsa?: string;
}

/**
 * Validates full birth chart input payload.
 * Rejects invalid or incomplete input with clear error messages.
 */
export function validateBirthInput(payload: BirthInputPayload): ValidationResult {
  const errors: Record<string, string> = {};

  // Parse date
  let y = payload.year;
  let m = payload.month;
  let d = payload.day;

  if (payload.date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) {
      errors.date = 'Date must be formatted strictly as YYYY-MM-DD.';
    } else {
      const parts = payload.date.split('-');
      y = parseInt(parts[0], 10);
      m = parseInt(parts[1], 10);
      d = parseInt(parts[2], 10);
    }
  }

  if (y === undefined || m === undefined || d === undefined) {
    errors.date = errors.date || 'Birth date (year, month, day) is required.';
  } else {
    const dateErr = validateDate(y, m, d);
    if (dateErr) errors.date = dateErr;
  }

  // Parse time
  const h = payload.hours;
  const min = payload.minutes;
  const s = payload.seconds;

  if (h === undefined || min === undefined || s === undefined) {
    errors.time = 'Birth time including hours, minutes, and seconds is required.';
  } else {
    const timeErr = validateTime(h, min, s);
    if (timeErr) errors.time = timeErr;
  }

  // Place
  if (!payload.placeText || typeof payload.placeText !== 'string' || !payload.placeText.trim()) {
    errors.place = 'Place of birth is required.';
  }

  // Coordinates
  if (payload.latitude === undefined || payload.longitude === undefined) {
    errors.coordinates = 'Coordinates (latitude and longitude) are required for house cusp calculations.';
  } else {
    const coordErr = validateCoordinates(payload.latitude, payload.longitude);
    if (coordErr) errors.coordinates = coordErr;
  }

  // Timezone
  if (!payload.timezone || typeof payload.timezone !== 'string') {
    errors.timezone = 'IANA timezone identifier is required.';
  } else if (!isValidTimezone(payload.timezone)) {
    errors.timezone = `Timezone "${payload.timezone}" is not a valid IANA timezone identifier.`;
  }

  // Ayanamsa
  const ayanamsaErr = validateAyanamsa(payload.ayanamsa);
  if (ayanamsaErr) {
    errors.ayanamsa = ayanamsaErr;
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  // Compute timezone offset with round-trip validation
  let tzResult;
  try {
    tzResult = computeTimezoneOffset(y!, m!, d!, h!, min!, s!, payload.timezone!);
  } catch (err: unknown) {
    errors.time = err instanceof Error ? err.message : 'Invalid time in given timezone.';
    return { valid: false, errors };
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${y}-${pad(m!)}-${pad(d!)}`;

  const rawInput: RawBirthInput = {
    date: dateStr,
    hours: h!,
    minutes: min!,
    seconds: s!,
    placeText: payload.placeText!.trim(),
    latitude: payload.latitude!,
    longitude: payload.longitude!,
    timezone: payload.timezone!,
    offsetString: tzResult.offsetString,
    offsetMinutes: tzResult.offsetMinutes,
    ayanamsa: payload.ayanamsa as AyanamsaMode,
  };

  const resolvedChartInput: ResolvedBirthChartInput = {
    id: `chart-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    createdAt: new Date().toISOString(),
    rawInput,
    resolvedPlace: {
      name: payload.placeText!.trim(),
      country: payload.country || '',
      countryCode: payload.countryCode || '',
      latitude: payload.latitude!,
      longitude: payload.longitude!,
      timezone: payload.timezone!,
      source: 'geocoded_place',
    },
    resolvedTime: {
      year: y!,
      month: m!,
      day: d!,
      hours: h!,
      minutes: min!,
      seconds: s!,
      utcIsoString: tzResult.utcDateTimeString,
      utcTimestamp: new Date(tzResult.utcDate).getTime(),
      offsetMinutes: tzResult.offsetMinutes,
      offsetSeconds: tzResult.offsetSeconds,
      offsetString: tzResult.offsetString,
      isDst: tzResult.isDst,
    },
    ayanamsa: payload.ayanamsa as AyanamsaMode,
    readyForCalculation: true,
  };

  return {
    valid: true,
    errors: {},
    resolvedChartInput,
  };
}
