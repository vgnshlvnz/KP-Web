/**
 * Ayanamsa definitions: the supported modes, and how each one that is not KP Old / KP New is
 * defined (work package add-ayanamsas, #64; owner decision on #29, 2026-11-21, answer A).
 *
 * Every mode is an explicit choice. There is no fallback: an unknown value is rejected by
 * `isAyanamsaMode` and by every function that takes an `AyanamsaMode`.
 * #22 decided (owner, #29): KP New is the UI's default selection; the API requires an explicit ayanamsa.
 *
 * Lahiri, Raman, Fagan-Bradley, Yukteshwar, J.N. Bhasin and Usha-Shashi are KP-Qt's own
 * computation (`astro::ayanamsa` in `kpqt-precession.ts`): IAU 1976 precession of the vernal
 * point, the `kAya[]` zero points, and KP-Qt's ΔT. The Julian day passed for those six is UT.
 * KP Old and KP New stay the polynomials in `astronomy.ts`. KP Straight Line (Adjusted) stays
 * the owner definition below.
 *
 * True ayanamsa = mean + nutation in longitude (dPsi), as for KP Old / KP New (except KPSTLA, whose
 * true value equals its mean, and Nil). Sidereal longitude =
 * tropical longitude (true equinox of date) - true ayanamsa.
 */
import type { AyanamsaMode } from './types.js';

/**
 * The option preselected in the UI. It is ONLY for the preselected UI option (and is listed by
 * `GET /api/health` and `GET /api/ayanamsa` so a client can preselect it). It is never used to fill
 * a missing `ayanamsa` in an API request: a request without one is rejected (400).
 * #22 decided (owner, #29): KP New is the UI's default selection; the API requires an explicit ayanamsa.
 */
export const DEFAULT_AYANAMSA_SELECTION: AyanamsaMode = 'kp_new';

/** Every supported mode, in the order they are shown to the user. */
export const AYANAMSA_MODES: readonly AyanamsaMode[] = [
  'kp_straight_line_adjusted',
  'kp_straight_line',
  'kp_ayanamsa',
  'kp_old',
  'kp_new',
  'lahiri',
  'raman',
  'fagan_bradley',
  'yukteshwar',
  'jn_bhasin',
  'usha_shashi',
  'nil',
];

/** Display names. */
export const AYANAMSA_LABELS: Readonly<Record<AyanamsaMode, string>> = {
  kp_straight_line_adjusted: 'KP Straight Line (Adjusted)',
  kp_straight_line: 'KP Straight Line',
  kp_ayanamsa: 'KP Ayanamsa',
  kp_old: 'KP Old',
  kp_new: 'KP New',
  lahiri: 'Lahiri',
  raman: 'Raman',
  fagan_bradley: 'Fagan-Bradley',
  yukteshwar: 'Yukteshwar',
  jn_bhasin: 'J.N. Bhasin',
  usha_shashi: 'Usha-Shashi',
  nil: 'Nil (tropical)',
};

/** True only for the exact lowercase wire ids in `AYANAMSA_MODES`. `'Lahiri'`, `'KP_OLD'`, `''` are not modes. */
export function isAyanamsaMode(value: unknown): value is AyanamsaMode {
  return typeof value === 'string' && (AYANAMSA_MODES as readonly string[]).includes(value);
}

/** Message for an unknown mode: lists the supported ids and says there is no fallback. */
export function unsupportedAyanamsaMessage(value: unknown): string {
  return `Unsupported ayanamsa mode: ${String(value)} (expected one of ${AYANAMSA_MODES.join(', ')}; there is no default and no fallback)`;
}


// ---------------------------------------------------------------------------
// KP Straight Line (Adjusted), "KPSTLA" (id `kp_straight_line_adjusted`)
// ---------------------------------------------------------------------------
//
// Owner definition (#29, 2026-11-21 16:49): KPSTLA = T x P / 3600 degrees, where T is the number of
// years since the base year 291 AD (zero ayanamsa) and P = 50.2388475 arcsec/yr (Newcomb's general
// precession). It has no Swiss Ephemeris definition. The choices below (G1 to G3, proposed in #29,
// comment 7065965531) are FINAL, decided (owner, #29, 2026-11-21 18:14Z / 2026-11-22 00:25Z): G1 zero point unchanged, G2 the Julian year (industry standard), G3 no nutation. https://github.com/vgnshlvnz/KP-Web/issues/29#issuecomment-7067103994 (answer), https://github.com/vgnshlvnz/KP-Web/issues/29#issuecomment-7067328469 (reading, approved at 00:25Z).

/**
 * G1 decided (owner, #29, 2026-11-21 18:14Z / 2026-11-22 00:25Z): the zero point is unchanged by the owner's answer. https://github.com/vgnshlvnz/KP-Web/issues/29#issuecomment-7067103994 (answer), https://github.com/vgnshlvnz/KP-Web/issues/29#issuecomment-7067328469 (reading, approved at 00:25Z).
 * Zero point: 291-01-01 0h UT in the Julian calendar = JD 1827345.5.
 */
export const KPSTLA_ZERO_JD = 1827345.5;

/**
 * G2 decided (owner, #29, 2026-11-21 18:14Z / 2026-11-22 00:25Z): the Julian year, the industry (IAU) standard year unit. https://github.com/vgnshlvnz/KP-Web/issues/29#issuecomment-7067103994 (answer), https://github.com/vgnshlvnz/KP-Web/issues/29#issuecomment-7067328469 (reading, approved at 00:25Z).
 * Length of the year used for T: the Julian year, 365.25 days (the IAU Julian year, the standard
 * astronomical year unit). The tropical year (365.242199 days) was not chosen; it differs by 1.8 arcsec at J2000.
 */
export const KPSTLA_YEAR_DAYS = 365.25;

/** Annual precession P, arcsec per year (Newcomb), from the owner's definition (#29). */
export const KPSTLA_PRECESSION_ARCSEC_PER_YEAR = 50.2388475;

/**
 * Mean KPSTLA ayanamsa, degrees, at Julian day `jd` (UT): T x P / 3600 with
 * T = (jd - KPSTLA_ZERO_JD) / KPSTLA_YEAR_DAYS.
 *
 * G3 decided (owner, #29, 2026-11-21 18:14Z / 2026-11-22 00:25Z): no nutation, the formula as given. https://github.com/vgnshlvnz/KP-Web/issues/29#issuecomment-7067103994 (answer), https://github.com/vgnshlvnz/KP-Web/issues/29#issuecomment-7067328469 (reading, approved at 00:25Z).
 * The formula is used exactly as given: `calculateAyanamsa` returns trueAyanamsa = meanAyanamsa for
 * this mode, with no nutation term (unlike every other mode except Nil; the sidereal longitudes
 * differ from "mean + dPsi" by up to about 17 arcsec, which is intended).
 */
export function meanAyanamsaKpStla(jd: number): number {
  const years = (jd - KPSTLA_ZERO_JD) / KPSTLA_YEAR_DAYS;
  return (years * KPSTLA_PRECESSION_ARCSEC_PER_YEAR) / 3600;
}

// ---------------------------------------------------------------------------
// KP Ayanamsa and KP Straight Line, from KP-Qt (src/livedata/kpAyanamsa.cpp
// on main @ e987302c3dfa04e579d1ac1605cd188d4750cfab, PR #92, merged). These are the two vendor systems in KP-Qt's product table
// that KP-Web did not already have. The constants below are copied from that
// file; they are not Swiss Ephemeris modes and they are not KP Old / KP New.
//
// KP-Qt evaluates them on the LOCAL civil date the user entered (integer
// year, month, day, hour, minute, second). The value does not depend on the
// UT instant. When that record is missing, KP-Qt falls back to the Gregorian
// date inside the Julian day (`astro::revjul`).
//
// KP Straight Line (Adjusted) in KP-Qt is a third formula, (frac - 291) *
// 50.2388475 / 3600, with frac measured from 15 April. KP-Web does not use
// that formula. KPSTLA stays the owner definition above (#29, G1–G3).
// ---------------------------------------------------------------------------

/** Annual rate shared by KP-Qt's three vendor formulas, arcsec per year. */
const KPQT_RATE_ARCSEC_PER_YEAR = 50.2388475;
/** Straight-line epoch year (KP-Qt `kEpoch`). */
const KPQT_EPOCH_YEAR = 291;
/** KP Ayanamsa base year (KP-Qt `kKpBaseYear`). */
const KPQT_KP_BASE_YEAR = 1900;
/** KP Ayanamsa constant term, arcsec (KP-Qt `kKpOffsetArcsec`). */
const KPQT_KP_OFFSET_ARCSEC = 1350;
/** KP Ayanamsa constant term, degrees (KP-Qt `kKpConstDeg`). */
const KPQT_KP_CONST_DEG = 22;
/** KP Ayanamsa quadratic term, arcsec per year squared (KP-Qt `kKpQuadArcsec`). */
const KPQT_KP_QUAD_ARCSEC = 0.000111;

/**
 * Local civil date, the record KP-Qt's `ayanamsaForKpSidMode` is called with.
 * Fields are truncated toward zero to integers inside the formula, matching
 * the C++ `int` parameters.
 */
export interface KpCivilDate {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** KP-Qt `daysInYear`: Julian leap rule before 1582, Gregorian from 1582. */
function kpQtDaysInYear(year: number): number {
  const leap =
    year < 1582 ? year % 4 === 0 : year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return leap ? 366 : 365;
}

/**
 * Days from 15 April 00:00 of `year` to the civil instant. Negative before
 * the anchor. KP-Qt `daysFromAnchor`.
 */
function kpQtDaysFromAnchor(year: number, month: number, day: number, hour: number, minute: number, second: number): number {
  const feb = year < 1582 ? (year % 4 === 0 ? 29 : 28) : year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  const dim = [31, feb, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let doy = day;
  for (let i = 0; i < month - 1; i++) doy += dim[i]!;
  const anchor = 31 + dim[1]! + 31 + 15;
  let days = doy - anchor;
  days += (hour + minute / 60 + second / 3600) / 24;
  return days;
}

/**
 * KP-Qt `kpFracYear`: `year + delta/daysInYear(year)` on or after 15 April,
 * otherwise `year - (-delta)/daysInYear(year-1)`.
 */
export function kpQtFracYear(civil: KpCivilDate): number {
  const year = Math.trunc(civil.year);
  const month = Math.trunc(civil.month);
  const day = Math.trunc(civil.day);
  const hour = Math.trunc(civil.hour);
  const minute = Math.trunc(civil.minute);
  const second = Math.trunc(civil.second);
  const delta = kpQtDaysFromAnchor(year, month, day, hour, minute, second);
  if (delta >= 0) return year + delta / kpQtDaysInYear(year);
  // delta is negative: year - (|delta| / length of the previous year).
  return year - (-delta) / kpQtDaysInYear(year - 1);
}

/**
 * Gregorian calendar date of a Julian day, using KP-Qt `astro::revjul` and
 * the same hour/minute/second split as `EphemerisEngine::ayanamsa` when no
 * KP date was supplied. `second` is rounded and is not carried into the minute.
 */
export function kpCivilFromJulianDay(jd: number): KpCivilDate {
  const z = Math.floor(jd + 0.5);
  const f = jd + 0.5 - z;
  let a = z;
  if (z >= 2299161) {
    const alpha = Math.floor((z - 1867216.25) / 36524.25);
    a = z + 1 + alpha - Math.floor(alpha / 4);
  }
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const dd = Math.floor(365.25 * c);
  const e = Math.floor((b - dd) / 30.6001);
  const dayWithFrac = b - dd - Math.floor(30.6001 * e) + f;
  const day = Math.floor(dayWithFrac);
  const hourFrac = (dayWithFrac - day) * 24;
  const month = e < 14 ? e - 1 : e - 13;
  const year = month > 2 ? c - 4716 : c - 4715;
  const hour = Math.trunc(hourFrac);
  const remAfterHour = hourFrac - hour;
  const minute = Math.trunc(remAfterHour * 60 + 1e-9);
  const remAfterMinute = remAfterHour - minute / 60;
  const second = Math.trunc(remAfterMinute * 60 + 0.5);
  return { year, month, day, hour, minute, second };
}

/**
 * KP Straight Line, degrees. KP-Qt `ayanamsaKpStraightLine`: the integer year
 * only, `(year - 291) * 50.2388475 / 3600`. Constant for the whole civil year.
 */
export function meanAyanamsaKpStraightLine(year: number): number {
  return ((Math.trunc(year) - KPQT_EPOCH_YEAR) * KPQT_RATE_ARCSEC_PER_YEAR) / 3600;
}

/**
 * KP Ayanamsa, degrees. KP-Qt `ayanamsaKpAyanamsa`:
 * `t = frac - 1900`, `(t * 50.2388475 + 1350) / 3600 + 22 + t*t*0.000111/3600`.
 */
export function meanAyanamsaKpAyanamsa(civil: KpCivilDate): number {
  const t = kpQtFracYear(civil) - KPQT_KP_BASE_YEAR;
  return (
    (t * KPQT_RATE_ARCSEC_PER_YEAR + KPQT_KP_OFFSET_ARCSEC) / 3600 +
    KPQT_KP_CONST_DEG +
    (t * t * KPQT_KP_QUAD_ARCSEC) / 3600
  );
}
