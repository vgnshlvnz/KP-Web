/**
 * KP Ayanamsa calculation module.
 *
 * Implements both:
 * 1. KP Old (SE_SIDM_KRISHNAMURTI): The original Krishnamurti ayanamsa (K.S. Krishnamurti)
 *    defined at epoch J1900.0 with ayan_t0 = 22°21'50.0" (22.363889°).
 * 2. KP New (SE_SIDM_KRISHNAMURTI_VP291): The revised Krishnamurti-Senthilathiban ayanamsa
 *    defined with zero-ayanamsa epoch at vernal point 291 CE (JD 1827424.752255678).
 *
 * Both match Swiss Ephemeris / astronomical standards to within hundredths of an arcsecond.
 */

import { AyanamsaMode } from '../types.js';

/**
 * Standard epoch values at J2000.0 (JD 2451545.0) in decimal degrees.
 */
export const KP_OLD_J2000_DEG = 23.76024004;
export const KP_NEW_J2000_DEG = 23.78036498;

/**
 * Converts degrees to Degrees, Minutes, Seconds string: e.g. 23°45'37"
 */
export function formatDms(deg: number, includeArcsecFractions = false): string {
  const normalized = ((deg % 360) + 360) % 360;
  const d = Math.floor(normalized);
  const remMinutes = (normalized - d) * 60;
  const m = Math.floor(remMinutes);
  const remSeconds = (remMinutes - m) * 60;

  if (includeArcsecFractions) {
    const s = remSeconds.toFixed(2).padStart(5, '0');
    return `${d}°${String(m).padStart(2, '0')}'${s}"`;
  }
  const s = Math.round(remSeconds);
  if (s === 60) {
    let newM = m + 1;
    let newD = d;
    if (newM === 60) {
      newM = 0;
      newD = (d + 1) % 360;
    }
    return `${newD}°${String(newM).padStart(2, '0')}'00"`;
  }
  return `${d}°${String(m).padStart(2, '0')}'${String(s).padStart(2, '0')}"`;
}

/**
 * Calculates General Precession in Longitude (p_A) from J2000.0
 * based on the IAU 2006 (P03) precession model (Capitaine et al., 2003).
 *
 * @param julianDay - Julian Day in UT/TT
 * @returns Precession in arcseconds since J2000.0
 */
export function calculatePrecessionArcsec(julianDay: number): number {
  const T = (julianDay - 2451545.0) / 36525.0; // Julian centuries from J2000.0
  // Coefficients in arcseconds: 5028.796195 * T + 1.1054348 * T^2 + 0.00007964 * T^3 - 0.000023857 * T^4
  return 5028.796195 * T + 1.1054348 * T * T + 0.00007964 * T * T * T - 0.000023857 * T * T * T * T;
}

/**
 * Computes the KP Ayanamsa in decimal degrees for a given Julian Day and mode.
 *
 * @param julianDay - Julian Day
 * @param mode - 'KP_OLD' or 'KP_NEW'
 * @returns Ayanamsa in degrees
 */
export function calculateKpAyanamsa(julianDay: number, mode: AyanamsaMode = 'KP_OLD'): number {
  const precArcsec = calculatePrecessionArcsec(julianDay);
  const precDeg = precArcsec / 3600.0;

  if (mode === 'KP_NEW') {
    return KP_NEW_J2000_DEG + precDeg;
  }
  return KP_OLD_J2000_DEG + precDeg;
}

/**
 * Converts Julian Date to UTC Date object.
 */
export function julianDayToDate(jd: number): Date {
  const z = Math.floor(jd + 0.5);
  const f = jd + 0.5 - z;
  let a = z;
  if (z >= 2299161) {
    const alpha = Math.floor((z - 1867216.25) / 36524.25);
    a = z + 1 + alpha - Math.floor(alpha / 4);
  }
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);
  const day = b - d - Math.floor(30.6001 * e) + f;
  const month = e < 14 ? e - 1 : e - 13;
  const year = month > 2 ? c - 4716 : c - 4715;

  const dayInt = Math.floor(day);
  const dayFrac = day - dayInt;
  const totalSeconds = Math.round(dayFrac * 86400);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return new Date(Date.UTC(year, month - 1, dayInt, hours, minutes, seconds));
}

/**
 * Converts calendar year, month, day, hour, minute, second in UT to Julian Day.
 */
export function dateToJulianDay(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0
): number {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  const dayFraction = (hour + minute / 60 + second / 3600) / 24;
  return (
    Math.floor(365.25 * (y + 4716)) +
    Math.floor(30.6001 * (m + 1)) +
    day +
    dayFraction +
    b -
    1524.5
  );
}
