import * as Astronomy from 'astronomy-engine';
import { AyanamsaType } from './types.js';
import {
  AYANAMSA_LABELS,
  isAyanamsaMode,
  isSeDefinedAyanamsaMode,
  meanAyanamsaKpStla,
  meanAyanamsaSeDefined,
  unsupportedAyanamsaMessage,
} from './ayanamsa-defs.js';

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

/**
 * Converts a Julian Day (UT) to a UTC `Date`, to the nearest second. Meeus, chapter 7 (inverse).
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
  const totalSeconds = Math.round((day - dayInt) * 86400);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return new Date(Date.UTC(year, month - 1, dayInt, hours, minutes, seconds));
}

/** Julian Day of the J2000.0 epoch. */
const JD_J2000 = 2451545.0;

/**
 * astronomy-engine time for a Julian Day in UT. astronomy-engine takes a numeric time as UT days
 * since J2000 and derives TT (via its own delta-T model) from it.
 */
function astroTimeFromJd(jd: number): Astronomy.AstroTime {
  return new Astronomy.AstroTime(jd - JD_J2000);
}

export interface NutationResult {
  dPsi: number; // Nutation in longitude (degrees)
  dEps: number; // Nutation in obliquity (degrees)
}

/**
 * Nutation in longitude (dPsi) and obliquity (dEps), in degrees, for a Julian Day in UT.
 *
 * Delegates to astronomy-engine (IAU 2000B), so that planets, cusps and the ayanamsa correction
 * all use one nutation model (port-ephemeris, #41; see #33). The signature is unchanged.
 */
export function calculateNutation(jd: number): NutationResult {
  const tilt = Astronomy.e_tilt(astroTimeFromJd(jd));
  // astronomy-engine reports both angles in arcseconds.
  return {
    dPsi: tilt.dpsi / 3600.0,
    dEps: tilt.deps / 3600.0,
  };
}

export interface ObliquityResult {
  meanObliquity: number; // degrees
  trueObliquity: number; // degrees
}

/**
 * Mean and true obliquity of the ecliptic, in degrees, for a Julian Day in UT.
 *
 * The mean obliquity is astronomy-engine's (IAU 2006). The true obliquity is the mean plus the
 * caller-supplied `dEps` (from `calculateNutation`), exactly as before.
 */
export function calculateObliquity(jd: number, dEps: number = 0): ObliquityResult {
  const eps0 = Astronomy.e_tilt(astroTimeFromJd(jd)).mobl;
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
 * Greenwich Mean Sidereal Time (GMST), Greenwich Apparent Sidereal Time (GAST), Local Apparent
 * Sidereal Time and ARMC, in hours and degrees, for a Julian Day in UT.
 *
 * GMST comes from astronomy-engine (IAU 2006). GAST = GMST + caller-supplied equation of the
 * equinoxes `dPsiDeg * cos(trueEpsDeg)`, as before, so a caller that passes dPsi = 0 still gets
 * GMST.
 */
export function calculateSiderealTime(
  jd: number,
  longitudeDeg: number,
  dPsiDeg: number = 0,
  trueEpsDeg: number = 23.439291
): SiderealTimeResult {
  const time = astroTimeFromJd(jd);
  // astronomy-engine returns apparent (GAST) hours; `ee` is the equation of the equinoxes it added,
  // in seconds of time. Removing it leaves GMST.
  const gastAeHours = Astronomy.SiderealTime(time);
  const eeAeHours = Astronomy.e_tilt(time).ee / 3600.0;
  const gmstHours = (((gastAeHours - eeAeHours) % 24.0) + 24.0) % 24.0;
  const gmstDegrees = normalizeDegrees(gmstHours * 15.0);

  // Equation of the equinoxes: EE = dPsi * cos(trueEps)
  const eqEquinoxesDeg = dPsiDeg * cosd(trueEpsDeg);

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

/**
 * Swiss Ephemeris mean ayanamsa at J2000.0 (JD 2451545.0), in degrees, as listed in audit.md
 * Appendix A.2. Reference values; `calculateAyanamsa` uses its own polynomial (kept from Stack A).
 */
export const KP_OLD_J2000_DEG = 23.76024004;
export const KP_NEW_J2000_DEG = 23.78036498;

/**
 * Formats decimal degrees (normalised to 0-360) as `D°MM'SS"`, e.g. `23°45'37"`. Degrees are not
 * zero-padded. Seconds are rounded to the whole second, with carry into minutes and degrees; with
 * `includeArcsecFractions` they keep two decimals (`23°45'36.86"`, no rounding carry).
 *
 * Moved from Stack B's ayanamsa module (deleted in `entrypoint`, #66) with identical
 * output. It is a different formatter from `formatDMS` in `kp-lords.ts`, which zero-pads degrees
 * (`03°40'12"`) and is used by the horary table; the two are not interchangeable.
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

export interface AyanamsaResult {
  type: AyanamsaType;
  name: string;
  meanAyanamsa: number; // degrees
  trueAyanamsa: number; // degrees (including nutation)
}

/**
 * Computes the ayanamsa of an explicitly chosen mode for the given Julian date.
 * KP Old: Krishnamurti original ayanamsa (Swiss Ephemeris SIDM_KRISHNAMURTI #5)
 *   Epoch: J1900.0 (JD 2415020.0), Ayanamsa = 22°21'50" = 22.363889°
 *   J2000.0 value: 23°45'36.86" = 23.760240°
 * KP New: Krishnamurti VP291 / Senthilathiban (Swiss Ephemeris SIDM_KRISHNAMURTI_VP291 #45)
 *   Epoch: Zero ayanamsa at 291 CE (JD 1827424.752255678)
 *   J2000.0 value: 23°46'49.31" = 23.780365°
 * Lahiri, Raman, Fagan-Bradley, Yukteshwar, J.N. Bhasin, Usha-Shashi: the Swiss Ephemeris 2.10.03
 *   modes of the same names, defined in `ayanamsa-defs.ts` (owner decision on #29, 2026-11-21).
 * Nil: the tropical zodiac. The mean and the true ayanamsa are both 0, and `dPsiDeg` is ignored,
 *   so sidereal longitude = tropical longitude.
 * Returns true ayanamsa (mean + nutation in longitude) to match Swiss Ephemeris sidereal houses
 * (except KPSTLA and Nil, whose true value equals the mean).
 *
 * KP Straight Line (Adjusted): mean = T x 50.2388475" / 3600, T = (jd - 1827345.5) / 365.25 (owner, #29;
 *   choices G1 to G3 in `ayanamsa-defs.ts`). G3 decided (owner, #29, 2026-11-21 18:14Z / 2026-11-22 00:25Z): industry standard; no nutation..
 *   The true ayanamsa equals the mean: `dPsiDeg` is ignored, like for Nil.
 *
 * #22 decided (owner, #29): KP New is the UI's default selection; the API requires an explicit ayanamsa.
 * `type` is a required parameter (this function used to default it to 'kp_old'), and any value that is
 * not one of the supported modes throws instead of silently becoming KP Old or Lahiri.
 */
export function calculateAyanamsa(
  jd: number,
  type: AyanamsaType,
  dPsiDeg: number = 0
): AyanamsaResult {
  // Never fall back to another mode (or to Lahiri) for an unknown value.
  if (!isAyanamsaMode(type)) {
    throw new Error(unsupportedAyanamsaMessage(type));
  }

  const T = (jd - 2451545.0) / 36525.0;

  let meanAyanamsa: number;
  let name: string;

  if (type === 'nil') {
    // Tropical: no ayanamsa, and no nutation term either (the planets and cusps are already in the
    // true equinox of date).
    return { type, name: AYANAMSA_LABELS.nil, meanAyanamsa: 0, trueAyanamsa: 0 };
  } else if (type === 'kp_straight_line_adjusted') {
    // G3 decided (owner, #29, 2026-11-21 18:14Z / 2026-11-22 00:25Z): industry standard; no nutation.: the formula as given, no nutation term.
    const mean = meanAyanamsaKpStla(jd);
    return { type, name: 'KP Straight Line (Adjusted)', meanAyanamsa: mean, trueAyanamsa: mean };
  } else if (type === 'kp_new') {
    name = 'KP New (VP291 / Senthilathiban)';
    // High-precision polynomial derived from IAU precession & Swiss Ephemeris SIDM_KRISHNAMURTI_VP291
    meanAyanamsa =
      23.780365 +
      1.39688162 * T +
      0.000306078 * T * T +
      0.00000000446 * T * T * T -
      0.00000000374 * T * T * T * T;
  } else if (type === 'kp_old') {
    name = 'KP Old (Krishnamurti original)';
    // High-precision polynomial derived from IAU precession & Swiss Ephemeris SIDM_KRISHNAMURTI
    meanAyanamsa =
      23.760240 +
      1.39688808 * T +
      0.000307064 * T * T +
      0.00000000227 * T * T * T -
      0.00000000411 * T * T * T * T;
  } else if (isSeDefinedAyanamsaMode(type)) {
    name = `${AYANAMSA_LABELS[type]} (Swiss Ephemeris)`;
    meanAyanamsa = meanAyanamsaSeDefined(type, T);
  } else {
    // Unreachable: every AyanamsaMode is handled above.
    throw new Error(unsupportedAyanamsaMessage(type));
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
