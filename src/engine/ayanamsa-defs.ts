/**
 * Ayanamsa definitions: the supported modes, and how each one that is not KP Old / KP New is
 * defined (work package add-ayanamsas, #64; owner decision on #29, 2026-11-21, answer A).
 *
 * Every mode is an explicit choice. There is no fallback: an unknown value is rejected by
 * `isAyanamsaMode` and by every function that takes an `AyanamsaMode`.
 * #22 decided (owner, #29): KP New is the UI's default selection; the API requires an explicit ayanamsa.
 *
 * "As Swiss Ephemeris defines them": each mode below is the Swiss Ephemeris 2.10.03 sidereal mode
 * of the same name, taken BY NAME (the `SE_SIDM_*` constant), not by KP-Qt's numbers (KP-Qt's
 * numeric mapping is wrong, #29). Swiss Ephemeris is used only to generate reference values for
 * `test/ayanamsa-reference.test.ts`; it is not a dependency.
 *
 * How the mean ayanamsa is computed (same approach as KP Old / KP New in `astronomy.ts`):
 *
 *     mean(T) = meanAtJ2000Deg + SE_PRECESSION_DEG_PER_CENTURY(T)
 *
 * with T in Julian centuries of 36525 days from J2000.0 (JD 2451545.0, TT). `meanAtJ2000Deg` is the
 * value Swiss Ephemeris 2.10.03 returns for that mode at J2000.0 (`swe_get_ayanamsa_ex` with
 * `SEFLG_NONUT`). The shared polynomial is the vernal point's precession measured on the ecliptic
 * of J1900.0, which is what SE does by default (`swi_get_ayanamsa_ex` in sweph.c, the branch without
 * `SE_SIDBIT_ECL_DATE`). Measured against SE 2.10.03 (yearly steps, 1700 to 2300) the largest
 * difference is 0.002 arcsec for every mode below.
 *
 * Why the J2000 value is pinned and not derived from the epoch `t0` and the value at it
 * (`ayanamsa[]` in sweph.h): for Fagan-Bradley, Lahiri and Raman, SE 2.10 corrects the table value
 * for the difference between the precession model the author used (Newcomb or IAU 1976) and SE's
 * default one (`get_aya_correction` in sweph.c), so its output at `t0` is up to 0.83 arcsec off the
 * table value. For Yukteshwar, J.N. Bhasin and Usha-Shashi the table value is reproduced exactly at
 * `t0`. Pinning SE's own J2000 output reproduces what SE returns in all six cases.
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

/** Modes computed from a Swiss Ephemeris definition (all except KPSTLA, KP Old, KP New and Nil). */
export type SeDefinedAyanamsaMode = Exclude<
  AyanamsaMode,
  'kp_straight_line_adjusted' | 'kp_straight_line' | 'kp_ayanamsa' | 'kp_old' | 'kp_new' | 'nil'
>;

export interface SeAyanamsaDefinition {
  /** Swiss Ephemeris constant, used by name. */
  seConstant: string;
  /** Epoch `t0` of the SE definition, JD (`ayanamsa[]` in sweph.h, SE 2.10.03). */
  t0Jd: number;
  /** Ayanamsa at `t0` as listed in sweph.h (before SE's precession-model correction), degrees. */
  ayanT0Deg: number;
  /** Mean ayanamsa at J2000.0 (JD 2451545.0 TT) as returned by SE 2.10.03 with SEFLG_NONUT, degrees. */
  meanAtJ2000Deg: number;
  /** Source of the definition, for the record. */
  source: string;
}

const J1900 = 2415020.0; // sweph.h J1900

export const SE_AYANAMSA_DEFINITIONS: Readonly<Record<SeDefinedAyanamsaMode, SeAyanamsaDefinition>> = {
  // SE_SIDM_LAHIRI (1). Calendar Reform Committee 1956, derived from the Indian Astronomical
  // Ephemeris 1989 p. 556: t0 = JD 2435553.5, 23.250182778 - 0.004658035 (the second term is nutation).
  lahiri: {
    seConstant: 'SE_SIDM_LAHIRI',
    t0Jd: 2435553.5,
    ayanT0Deg: 23.250182778 - 0.004658035,
    meanAtJ2000Deg: 23.8570923254552,
    source: 'sweph.h ayanamsa[1]; SE 2.10.03',
  },
  // SE_SIDM_RAMAN (3). B.V. Raman, "Hindu Predictive Astrology": t0 = J1900, 360 - 338.98556.
  raman: {
    seConstant: 'SE_SIDM_RAMAN',
    t0Jd: J1900,
    ayanT0Deg: 360 - 338.98556,
    meanAtJ2000Deg: 22.41079101207282,
    source: 'sweph.h ayanamsa[3]; SE 2.10.03',
  },
  // SE_SIDM_FAGAN_BRADLEY (0). SVP 335 deg 57' 28.64" for 1950.0: t0 = JD 2433282.42346, 24.042044444.
  fagan_bradley: {
    seConstant: 'SE_SIDM_FAGAN_BRADLEY',
    t0Jd: 2433282.42346,
    ayanT0Deg: 24.042044444,
    meanAtJ2000Deg: 24.740299966181283,
    source: 'sweph.h ayanamsa[0]; SE 2.10.03',
  },
  // SE_SIDM_YUKTESHWAR (7). Sri Yukteswar, "The Holy Science": t0 = J1900, 360 - 338.917778.
  yukteshwar: {
    seConstant: 'SE_SIDM_YUKTESHWAR',
    t0Jd: J1900,
    ayanT0Deg: 360 - 338.917778,
    meanAtJ2000Deg: 22.47880299955449,
    source: 'sweph.h ayanamsa[7]; SE 2.10.03',
  },
  // SE_SIDM_JN_BHASIN (8). No source given by SE: t0 = J1900, 360 - 338.634444.
  jn_bhasin: {
    seConstant: 'SE_SIDM_JN_BHASIN',
    t0Jd: J1900,
    ayanT0Deg: 360 - 338.634444,
    meanAtJ2000Deg: 22.762136999554514,
    source: 'sweph.h ayanamsa[8]; SE 2.10.03',
  },
  // SE_SIDM_USHASHASHI (4). Usha and Shashi, "Hindu Astrological Calculations" (1978): t0 = J1900,
  // 360 - 341.33904.
  usha_shashi: {
    seConstant: 'SE_SIDM_USHASHASHI',
    t0Jd: J1900,
    ayanT0Deg: 360 - 341.33904,
    meanAtJ2000Deg: 20.057540999554476,
    source: 'sweph.h ayanamsa[4]; SE 2.10.03',
  },
};

/**
 * Precession of the vernal point on the ecliptic of J1900.0, degrees per Julian century, as
 * [T, T^2, T^3, T^4] coefficients (no constant term). These are the same coefficients as KP Old in
 * `calculateAyanamsa`; the six SE-defined modes have `t0` between 1900 and 1956, so they share it.
 */
export const SE_PRECESSION_DEG_PER_CENTURY: readonly [number, number, number, number] = [
  1.39688808, 0.000307064, 0.00000000227, -0.00000000411,
];

/** True for the modes defined by `SE_AYANAMSA_DEFINITIONS`. */
export function isSeDefinedAyanamsaMode(mode: AyanamsaMode): mode is SeDefinedAyanamsaMode {
  return Object.prototype.hasOwnProperty.call(SE_AYANAMSA_DEFINITIONS, mode);
}

/** Mean ayanamsa, degrees, of an SE-defined mode at `T` Julian centuries from J2000.0. */
export function meanAyanamsaSeDefined(mode: SeDefinedAyanamsaMode, T: number): number {
  const [c1, c2, c3, c4] = SE_PRECESSION_DEG_PER_CENTURY;
  return SE_AYANAMSA_DEFINITIONS[mode].meanAtJ2000Deg + c1 * T + c2 * T * T + c3 * T * T * T + c4 * T * T * T * T;
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
// KP Ayanamsa and KP Straight Line, from KP-Qt (src/livedata/kpAyanamsa.cpp,
// commit 83264c65). These are the two vendor systems in KP-Qt's product table
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
