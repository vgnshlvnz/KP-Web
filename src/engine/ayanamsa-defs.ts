/**
 * Ayanamsa definitions: the supported modes, and how each one that is not KP Old / KP New is
 * defined (work package add-ayanamsas, #64; owner decision on #29, 2026-11-21, answer A).
 *
 * Every mode is an explicit choice. There is no fallback: an unknown value is rejected by
 * `isAyanamsaMode` and by every function that takes an `AyanamsaMode`.
 * #22 decided (owner, #29): default *selection* is KPSTLA; the API still requires an explicit ayanamsa (no fallback).
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
 * True ayanamsa = mean + nutation in longitude (dPsi), as for KP Old / KP New. Sidereal longitude =
 * tropical longitude (true equinox of date) - true ayanamsa.
 */
import type { AyanamsaMode } from './types.js';

/**
 * The option preselected in the UI. It is ONLY for the preselected UI option (and is listed by
 * `GET /api/health` and `GET /api/ayanamsa` so a client can preselect it). It is never used to fill
 * a missing `ayanamsa` in an API request: a request without one is rejected (400).
 * #22 decided (owner, #29): default *selection* is KPSTLA; the API still requires an explicit ayanamsa (no fallback).
 */
export const DEFAULT_AYANAMSA_SELECTION: AyanamsaMode = 'kp_straight_line_adjusted';

/** Every supported mode, in the order they are shown to the user. */
export const AYANAMSA_MODES: readonly AyanamsaMode[] = [
  'kp_straight_line_adjusted',
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
export type SeDefinedAyanamsaMode = Exclude<AyanamsaMode, 'kp_straight_line_adjusted' | 'kp_old' | 'kp_new' | 'nil'>;

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
// precession). It has no Swiss Ephemeris definition. The choices below are the orchestrator's
// proposals G1 to G3 (#29, comment 7065965531), applied PROVISIONALLY: "we will do the test and
// reference checks later. build first" (owner, 2026-11-22). Owner to confirm; reference check pending.

/**
 * TODO(#29 G1): provisional, owner to confirm; reference check pending.
 * Zero point: 291-01-01 0h UT in the Julian calendar = JD 1827345.5.
 */
export const KPSTLA_ZERO_JD = 1827345.5;

/**
 * TODO(#29 G2): provisional, owner to confirm; reference check pending.
 * Length of the year used for T: the Julian year, 365.25 days (G2a). The alternative (G2b) is the
 * tropical year, 365.242199 days, which differs by 1.8 arcsec at J2000.
 */
export const KPSTLA_YEAR_DAYS = 365.25;

/** Annual precession P, arcsec per year (Newcomb), from the owner's definition (#29). */
export const KPSTLA_PRECESSION_ARCSEC_PER_YEAR = 50.2388475;

/**
 * Mean KPSTLA ayanamsa, degrees, at Julian day `jd` (UT): T x P / 3600 with
 * T = (jd - KPSTLA_ZERO_JD) / KPSTLA_YEAR_DAYS.
 *
 * TODO(#29 G3): provisional, owner to confirm; reference check pending. This is a MEAN ayanamsa;
 * `calculateAyanamsa` adds the nutation in longitude, as for every other mode (G3a). The
 * alternative (G3b) is to use it as given, with no nutation term (differs by up to about 17 arcsec).
 */
export function meanAyanamsaKpStla(jd: number): number {
  const years = (jd - KPSTLA_ZERO_JD) / KPSTLA_YEAR_DAYS;
  return (years * KPSTLA_PRECESSION_ARCSEC_PER_YEAR) / 3600;
}
