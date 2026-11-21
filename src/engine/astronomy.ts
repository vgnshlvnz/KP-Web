import { AyanamsaType } from './types.js';

export const DEG2RAD = Math.PI / 180.0;
export const RAD2DEG = 180.0 / Math.PI;

export function normalizeDegrees(deg: number): number {
  let d = deg % 360.0;
  if (d < 0.0) {
    d += 360.0;
  }
  return d;
}

export function sind(deg: number): number {
  return Math.sin(deg * DEG2RAD);
}

export function cosd(deg: number): number {
  return Math.cos(deg * DEG2RAD);
}

export function tand(deg: number): number {
  return Math.tan(deg * DEG2RAD);
}

export function asind(x: number): number {
  return Math.asin(Math.max(-1.0, Math.min(1.0, x))) * RAD2DEG;
}

export function atand(x: number): number {
  return Math.atan(x) * RAD2DEG;
}

export function atan2d(y: number, x: number): number {
  return Math.atan2(y, x) * RAD2DEG;
}

/**
 * Calculates Julian Day Number from calendar date and time in Universal Time (UT).
 * Based on Jean Meeus, Astronomical Algorithms, Chapter 7.
 */
export function toJulianDate(
  year: number,
  month: number,
  day: number,
  hour: number = 0,
  minute: number = 0,
  second: number = 0
): number {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  const dayFraction = day + (hour + minute / 60.0 + second / 3600.0) / 24.0;
  const jd = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + dayFraction + b - 1524.5;
  return jd;
}

export interface NutationResult {
  dPsi: number; // Nutation in longitude (degrees)
  dEps: number; // Nutation in obliquity (degrees)
}

/**
 * Computes nutation in longitude (dPsi) and obliquity (dEps) using the IAU 1980 / Meeus theory.
 * Returns values in degrees.
 */
export function calculateNutation(jd: number): NutationResult {
  const T = (jd - 2451545.0) / 36525.0;

  // Fundamental Delaunay arguments in degrees
  const omega = normalizeDegrees(125.04452 - 1934.136261 * T + 0.0020708 * T * T + (T * T * T) / 450000.0);
  const L = normalizeDegrees(280.4665 + 36000.7698 * T); // Sun mean longitude
  const Lp = normalizeDegrees(218.3165 + 481267.8813 * T); // Moon mean longitude
  const D = normalizeDegrees(297.85036 + 445267.11148 * T); // Moon mean elongation
  const M = normalizeDegrees(357.52772 + 35999.05034 * T); // Sun mean anomaly
  const Mp = normalizeDegrees(134.96298 + 477198.867398 * T); // Moon mean anomaly

  // Nutation terms (in arcseconds)
  let dPsiSec =
    -17.1996 * sind(omega) +
    -1.3187 * sind(2 * L) +
    -0.2274 * sind(2 * Lp) +
    0.2062 * sind(2 * omega) +
    0.1426 * sind(M) +
    0.0712 * sind(Mp) +
    -0.0517 * sind(2 * L - omega) +
    -0.0386 * sind(2 * D - omega) +
    -0.0301 * sind(2 * Lp + Mp) +
    0.0217 * sind(2 * L - M) +
    -0.0158 * sind(2 * D - Mp) +
    0.0129 * sind(2 * L - 2 * D + omega) +
    0.0123 * sind(2 * Lp - omega);

  let dEpsSec =
    9.2025 * cosd(omega) +
    0.5736 * cosd(2 * L) +
    0.0977 * cosd(2 * Lp) +
    -0.0895 * cosd(2 * omega) +
    0.0054 * cosd(M) +
    -0.0007 * cosd(Mp) +
    0.0224 * cosd(2 * L - omega) +
    0.0200 * cosd(2 * D - omega) +
    0.0129 * cosd(2 * Lp + Mp) +
    -0.0095 * cosd(2 * L - M);

  return {
    dPsi: dPsiSec / 3600.0,
    dEps: dEpsSec / 3600.0,
  };
}

export interface ObliquityResult {
  meanObliquity: number; // degrees
  trueObliquity: number; // degrees
}

/**
 * Computes mean and true obliquity of the ecliptic using Laskar / IAU 2006 formula.
 * Returns values in degrees.
 */
export function calculateObliquity(jd: number, dEps: number = 0): ObliquityResult {
  const T = (jd - 2451545.0) / 36525.0;
  // Laskar's formula for mean obliquity (Meeus eq 22.2)
  const eps0 =
    23.4392911111 -
    (46.815 * T + 0.00059 * T * T - 0.001813 * T * T * T) / 3600.0;
  return {
    meanObliquity: eps0,
    trueObliquity: eps0 + dEps,
  };
}

export interface SiderealTimeResult {
  gmstHours: number;
  gmstDegrees: number;
  gastHours: number;
  gastDegrees: number;
  lstHours: number;
  lstDegrees: number;
  armc: number; // Right Ascension of Midheaven in degrees (0-360)
}

/**
 * Computes Greenwich Mean Sidereal Time (GMST), Greenwich Apparent Sidereal Time (GAST),
 * Local Apparent Sidereal Time (LAST), and ARMC in degrees.
 * Based on IAU 1982 / 2006 standards.
 */
export function calculateSiderealTime(
  jd: number,
  longitudeDeg: number,
  dPsiDeg: number = 0,
  trueEpsDeg: number = 23.439291
): SiderealTimeResult {
  // Midnight UT Julian Day
  const jd0 = Math.floor(jd - 0.5) + 0.5;
  const dayFrac = jd - jd0; // 0.0 to 1.0 (UT fraction of day)
  const utHours = dayFrac * 24.0;

  const T0 = (jd0 - 2451545.0) / 36525.0;

  // GMST at 0h UT in seconds
  let gmstSeconds =
    24110.54841 +
    8640184.812866 * T0 +
    0.093104 * T0 * T0 -
    0.0000062 * T0 * T0 * T0;

  // Advance to given UT
  gmstSeconds += utHours * 3600.0 * 1.002737909350795;

  // Normalize to [0, 86400) seconds
  gmstSeconds = ((gmstSeconds % 86400.0) + 86400.0) % 86400.0;

  const gmstHours = gmstSeconds / 3600.0;
  const gmstDegrees = normalizeDegrees(gmstHours * 15.0);

  // Equation of the equinoxes: EE = dPsi * cos(trueEps)
  const eqEquinoxesDeg = dPsiDeg * cosd(trueEpsDeg);
  const eqEquinoxesHours = eqEquinoxesDeg / 15.0;

  const gastDegrees = normalizeDegrees(gmstDegrees + eqEquinoxesDeg);
  const gastHours = gastDegrees / 15.0;

  // Local Sidereal Time / ARMC (Right Ascension of Meridian / Midheaven)
  const armc = normalizeDegrees(gastDegrees + longitudeDeg);
  const lstDegrees = armc;
  const lstHours = lstDegrees / 15.0;

  return {
    gmstHours,
    gmstDegrees,
    gastHours,
    gastDegrees,
    lstHours,
    lstDegrees,
    armc,
  };
}

export interface AyanamsaResult {
  type: AyanamsaType;
  name: string;
  meanAyanamsa: number; // degrees
  trueAyanamsa: number; // degrees (including nutation)
}

/**
 * Computes KP Ayanamsa (KP Old or KP New) for the given Julian date.
 * KP Old: Krishnamurti original ayanamsa (Swiss Ephemeris SIDM_KRISHNAMURTI #5)
 *   Epoch: J1900.0 (JD 2415020.0), Ayanamsa = 22°21'50" = 22.363889°
 *   J2000.0 value: 23°45'36.86" = 23.760240°
 * KP New: Krishnamurti VP291 / Senthilathiban (Swiss Ephemeris SIDM_KRISHNAMURTI_VP291 #45)
 *   Epoch: Zero ayanamsa at 291 CE (JD 1827424.752255678)
 *   J2000.0 value: 23°46'49.31" = 23.780365°
 * Returns true ayanamsa (mean + nutation in longitude) to match Swiss Ephemeris sidereal houses.
 */
export function calculateAyanamsa(
  jd: number,
  type: AyanamsaType = 'kp_old',
  dPsiDeg: number = 0
): AyanamsaResult {
  const T = (jd - 2451545.0) / 36525.0;

  let meanAyanamsa: number;
  let name: string;

  if (type === 'kp_new') {
    name = 'KP New (VP291 / Senthilathiban)';
    // High-precision polynomial derived from IAU precession & Swiss Ephemeris SIDM_KRISHNAMURTI_VP291
    meanAyanamsa =
      23.780365 +
      1.39688162 * T +
      0.000306078 * T * T +
      0.00000000446 * T * T * T -
      0.00000000374 * T * T * T * T;
  } else {
    name = 'KP Old (Krishnamurti original)';
    // High-precision polynomial derived from IAU precession & Swiss Ephemeris SIDM_KRISHNAMURTI
    meanAyanamsa =
      23.760240 +
      1.39688808 * T +
      0.000307064 * T * T +
      0.00000000227 * T * T * T -
      0.00000000411 * T * T * T * T;
  }

  // True ayanamsa includes nutation in longitude
  const trueAyanamsa = meanAyanamsa + dPsiDeg;

  return {
    type,
    name,
    meanAyanamsa,
    trueAyanamsa,
  };
}
