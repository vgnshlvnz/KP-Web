import * as Astronomy from 'astronomy-engine';
import { AyanamsaType } from './types.js';
import { nutationIau2000b } from './nutation.js';
import {
  AYANAMSA_LABELS,
  calendarFromJulianDay,
  isAyanamsaMode,
  kpCivilFromJulianDay,
  meanAyanamsaKpAyanamsa,
  meanAyanamsaKpStla,
  meanAyanamsaKpStraightLine,
  unsupportedAyanamsaMessage,
  type KpCivilDate,
} from './ayanamsa-defs.js';
import { isKpQtTableAyanamsa, meanAyanamsaKpQt } from './kpqt-precession.js';

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
 * The one nutation function of the engine (#57). It evaluates the full 77-term IAU 2000B series
 * (`nutation.ts`), the model Swiss Ephemeris uses, at the TT of the instant. astronomy-engine's own
 * `e_tilt` (a 5-term truncation) is not used for any nutation value any more; see `ephemeris.ts` for how
 * the planet longitudes, which astronomy-engine produces in its own true equinox, are put on this
 * nutation. The signature is unchanged.
 */
export function calculateNutation(jd: number): NutationResult {
  return nutationAtTime(astroTimeFromJd(jd));
}

/**
 * Same as `calculateNutation`, for an astronomy-engine time (which already carries the UT -> TT
 * conversion). `ephemeris.ts` uses this so that a `Date` and its Julian Day give one answer.
 */
export function nutationAtTime(time: Astronomy.AstroTime): NutationResult {
  const nut = nutationIau2000b(time.tt + JD_J2000);
  return {
    dPsi: nut.dPsiArcsec / 3600.0,
    dEps: nut.dEpsArcsec / 3600.0,
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
 * Greenwich Mean Sidereal Time in degrees (0-360) for an astronomy-engine time: the Earth Rotation
 * Angle (from UT) plus the IAU 2006 polynomial in TT (Capitaine, Wallace & Chapront 2003; the same
 * expression astronomy-engine uses, without its equation of the equinoxes). It uses no nutation.
 */
function greenwichMeanSiderealDegrees(time: Astronomy.AstroTime): number {
  const t = time.tt / 36525.0;
  // Earth Rotation Angle: UT days since J2000, in turns.
  const thet1 = 0.779057273264 + 0.00273781191135448 * time.ut;
  const thet3 = time.ut % 1;
  const eraDeg = 360.0 * ((thet1 + thet3) % 1);
  const polyArcsec =
    0.014506 +
    ((((-0.0000000368 * t - 0.000029956) * t - 0.00000044) * t + 1.3915817) * t + 4612.156534) * t;
  return normalizeDegrees(eraDeg + polyArcsec / 3600.0);
}

/**
 * Greenwich Mean Sidereal Time (GMST), Greenwich Apparent Sidereal Time (GAST), Local Apparent
 * Sidereal Time and ARMC, in hours and degrees, for a Julian Day in UT.
 *
 * GMST is the IAU 2006 expression (ERA + polynomial, no nutation). GAST = GMST + the caller's
 * equation of the equinoxes `dPsiDeg * cos(trueEpsDeg)`, with dPsi and the true obliquity from
 * `calculateNutation` / `calculateObliquity` (#57), so a caller that passes dPsi = 0 still gets
 * GMST. As in Swiss Ephemeris `swe_sidtime`, the equation of the equinoxes uses the TRUE obliquity.
 * What is left against Swiss Ephemeris is its complementary terms (under about 3 mas).
 */
export function calculateSiderealTime(
  jd: number,
  longitudeDeg: number,
  dPsiDeg: number = 0,
  trueEpsDeg: number = 23.439291
): SiderealTimeResult {
  const time = astroTimeFromJd(jd);
  const gmstDegrees = greenwichMeanSiderealDegrees(time);
  const gmstHours = gmstDegrees / 15.0;

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
 * Lahiri, Raman, Fagan-Bradley, Yukteshwar, J.N. Bhasin, Usha-Shashi: KP-Qt's `astro::ayanamsa`
 *   (`kpqt-precession.ts`). `jd` for these six is UT; the function applies KP-Qt's ΔT itself.
 * Nil: the tropical zodiac. The mean and the true ayanamsa are both 0, and `dPsiDeg` is ignored,
 *   so sidereal longitude = tropical longitude.
 * Returns true ayanamsa (mean + nutation in longitude) to match Swiss Ephemeris sidereal houses
 * (except KPSTLA and Nil, whose true value equals the mean). KP Straight Line and KP Ayanamsa
 * use the KP-Qt mean formulas; their true value still adds nutation, as KP-Qt's sidereal offset does.
 *
 * KP Straight Line (Adjusted): mean = T x 50.2388475" / 3600, T = (jd - 1827345.5) / 365.25 (owner, #29;
 *   choices G1 to G3 in `ayanamsa-defs.ts`). G3 decided (owner, #29, 2026-11-21 18:14Z / 2026-11-22 00:25Z): no nutation.
 *   The true ayanamsa equals the mean: `dPsiDeg` is ignored, like for Nil.
 * KP Straight Line and KP Ayanamsa: KP-Qt's formulas in `ayanamsa-defs.ts` (`kpAyanamsa.cpp`),
 *   evaluated on `civil` (the local date the user entered) or, when `civil` is omitted, on the
 *   Gregorian date of `jd`. Their mean has no nutation term. The true value is mean + `dPsiDeg`,
 *   which is what KP-Qt subtracts (`siderealOffset = ayanamsa + nutation`).
 *
 * #22 decided (owner, #29): KP New is the UI's default selection; the API requires an explicit ayanamsa.
 * `type` is a required parameter (this function used to default it to 'kp_old'), and any value that is
 * not one of the supported modes throws instead of silently becoming KP Old or Lahiri.
 */
export function calculateAyanamsa(
  jd: number,
  type: AyanamsaType,
  dPsiDeg: number = 0,
  civil?: KpCivilDate
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
    // G3 decided (owner, #29, 2026-11-21 18:14Z / 2026-11-22 00:25Z): the formula as given, no nutation term.
    // `civil` is ignored: this is the owner definition, not KP-Qt's 15 April fractional year.
    const mean = meanAyanamsaKpStla(jd);
    return { type, name: 'KP Straight Line (Adjusted)', meanAyanamsa: mean, trueAyanamsa: mean };
  } else if (type === 'kp_straight_line') {
    const date = civil ?? kpCivilFromJulianDay(jd);
    const mean = meanAyanamsaKpStraightLine(date.year);
    return { type, name: AYANAMSA_LABELS.kp_straight_line, meanAyanamsa: mean, trueAyanamsa: mean + dPsiDeg };
  } else if (type === 'kp_ayanamsa') {
    const date = civil ?? kpCivilFromJulianDay(jd);
    const mean = meanAyanamsaKpAyanamsa(date);
    return { type, name: AYANAMSA_LABELS.kp_ayanamsa, meanAyanamsa: mean, trueAyanamsa: mean + dPsiDeg };
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
  } else if (isKpQtTableAyanamsa(type)) {
    // Name string kept. The value is KP-Qt's mean at this UT Julian day.
    name = `${AYANAMSA_LABELS[type]} (Swiss Ephemeris)`;
    meanAyanamsa = meanAyanamsaKpQt(jd, type);
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
