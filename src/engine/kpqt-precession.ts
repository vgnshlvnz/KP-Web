/**
 * Mean ayanamsa of Lahiri, Raman, Fagan-Bradley, Yukteshwar, J.N. Bhasin and Usha-Shashi,
 * copied from KP-Qt `src/ephemeris/astro.cpp` (`astro::ayanamsa`, `kAya[]`, `deltaT`,
 * `precess`, `meanObliquity`, `coortrf`) at commit 83264c65.
 *
 * The input is a Julian day in UT, as `EphemerisEngine::ayanamsa` passes it. TT is
 * UT + KP-Qt's Espenak–Meeus ΔT. The result is the mean (no nutation). The caller adds
 * nutation for the true value, which is KP-Qt's `siderealOffset = ayanamsa + nutation`.
 *
 * Constants are the literals in that file, including the truncated degree/radian factors.
 * This is not the Swiss Ephemeris 2.10 definition.
 */
import type { AyanamsaMode } from './types.js';

const K_J2000 = 2451545.0;
const K_J1900 = 2415020.0;
/** KP-Qt `astro::kDeg`, not `Math.PI / 180`. */
const K_DEG = 0.0174532925199433;
/** KP-Qt `astro::kRad`, not `180 / Math.PI`. */
const K_RAD = 57.2957795130823;

export type KpQtTableAyanamsaMode =
  | 'lahiri'
  | 'raman'
  | 'fagan_bradley'
  | 'yukteshwar'
  | 'jn_bhasin'
  | 'usha_shashi';

/**
 * `kAya[]` rows KP-Qt selects by `SE_SIDM_*` index. `t0` and `ayanT0` are the table
 * literals (`360 - x` is evaluated, matching the C++ aggregate).
 */
export const KPQT_AYA_TABLE: Readonly<
  Record<KpQtTableAyanamsaMode, { sidMode: number; t0: number; ayanT0: number }>
> = {
  fagan_bradley: { sidMode: 0, t0: 2433282.5, ayanT0: 24.042044444 },
  lahiri: { sidMode: 1, t0: K_J1900, ayanT0: 360.0 - 337.53953 },
  raman: { sidMode: 3, t0: K_J1900, ayanT0: 360.0 - 338.98556 },
  usha_shashi: { sidMode: 4, t0: K_J1900, ayanT0: 360.0 - 341.33904 },
  yukteshwar: { sidMode: 7, t0: K_J1900, ayanT0: 360.0 - 338.917778 },
  jn_bhasin: { sidMode: 8, t0: K_J1900, ayanT0: 360.0 - 338.634444 },
};

export function isKpQtTableAyanamsa(mode: AyanamsaMode): mode is KpQtTableAyanamsaMode {
  return Object.prototype.hasOwnProperty.call(KPQT_AYA_TABLE, mode);
}

function norm360(d: number): number {
  d = d % 360.0;
  if (d < 0.0) d += 360.0;
  return d;
}

/** KP-Qt `astro::deltaT`. Returns TT − UT in days. */
function deltaT(jdUt: number): number {
  const Y = 2000.0 + (jdUt - K_J2000) / 365.25;
  let dt: number;
  if (Y < 500.0) {
    const u = Y / 100.0;
    dt =
      10583.6 -
      1014.41 * u +
      33.78311 * u * u -
      5.952053 * u * u * u -
      0.1798452 * u ** 4 +
      0.022174192 * u ** 5 +
      0.0090316521 * u ** 6;
  } else if (Y < 1600.0) {
    const u = (Y - 1000.0) / 100.0;
    dt =
      1574.2 -
      556.01 * u +
      71.23472 * u * u +
      0.319781 * u * u * u -
      0.8503463 * u ** 4 -
      0.005050998 * u ** 5 +
      0.0083572073 * u ** 6;
  } else if (Y < 1700.0) {
    const t = Y - 1600.0;
    dt = 120.0 - 0.9808 * t - 0.01532 * t * t + (t * t * t) / 7129.0;
  } else if (Y < 1800.0) {
    const t = Y - 1700.0;
    dt = 8.83 + 0.1603 * t - 0.0059285 * t * t + 0.00013336 * t * t * t - (t * t * t * t) / 1174000.0;
  } else if (Y < 1860.0) {
    const t = Y - 1800.0;
    dt =
      13.72 -
      0.332447 * t +
      0.0068612 * t * t +
      0.0041116 * t * t * t -
      0.00037436 * t ** 4 +
      0.0000121272 * t ** 5 -
      0.0000001699 * t ** 6 +
      0.000000000875 * t ** 7;
  } else if (Y < 1900.0) {
    const t = Y - 1860.0;
    dt = 7.62 + 0.5737 * t - 0.251754 * t * t + 0.01680668 * t * t * t - 0.0004473624 * t ** 4 + t ** 5 / 233174.0;
  } else if (Y < 1920.0) {
    const t = Y - 1900.0;
    dt = -2.79 + 1.494119 * t - 0.0598939 * t * t + 0.0061966 * t * t * t - 0.000197 * t ** 4;
  } else if (Y < 1941.0) {
    const t = Y - 1920.0;
    dt = 21.2 + 0.84493 * t - 0.0761 * t * t + 0.0020936 * t * t * t;
  } else if (Y < 1961.0) {
    const t = Y - 1950.0;
    dt = 29.07 + 0.407 * t - (t * t) / 233.0 + (t * t * t) / 2547.0;
  } else if (Y < 1986.0) {
    const t = Y - 1975.0;
    dt = 45.45 + 1.067 * t - (t * t) / 260.0 - (t * t * t) / 718.0;
  } else if (Y < 2005.0) {
    const t = Y - 2000.0;
    dt = 63.86 + 0.3345 * t - 0.060374 * t * t + 0.0017275 * t * t * t + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5;
  } else if (Y < 2050.0) {
    const t = Y - 2000.0;
    dt = 62.92 + 0.32217 * t + 0.005589 * t * t;
  } else {
    const u = (Y - 1820.0) / 100.0;
    dt = -20.0 + 32.0 * u * u;
  }
  return dt / 86400.0;
}

function jdTt(jdUt: number): number {
  return jdUt + deltaT(jdUt);
}

/** Mean obliquity in radians. KP-Qt `astro::meanObliquity`. */
function meanObliquity(jdTtValue: number): number {
  const T = (jdTtValue - K_J2000) / 36525.0;
  let eps: number;
  if (Math.abs(T) < 2.0) {
    eps = ((1.813e-3 * T - 5.9e-4) * T - 46.815) * T + 84381.448;
  } else {
    const t = T / 10.0;
    eps = 2.45e-10 * t + 5.79e-9;
    eps = eps * t + 2.787e-7;
    eps = eps * t + 7.12e-7;
    eps = eps * t - 3.905e-5;
    eps = eps * t - 2.4967e-3;
    eps = eps * t - 5.138e-3;
    eps = eps * t + 1.99925;
    eps = eps * t - 0.0155;
    eps = eps * t - 468.093;
    eps = eps * t + 84381.448;
  }
  return (eps * K_DEG) / 3600.0;
}

/** IAU 1976 precession of an equatorial cartesian vector. KP-Qt `astro::precess`. */
function precess(v: [number, number, number], jdTtValue: number, direction: number): void {
  if (jdTtValue === K_J2000) return;
  const T = (jdTtValue - K_J2000) / 36525.0;
  const Z = ((0.017998 * T + 0.30188) * T + 2306.2181) * T * K_DEG / 3600.0;
  const z = ((0.018203 * T + 1.09468) * T + 2306.2181) * T * K_DEG / 3600.0;
  const TH = ((-0.041833 * T - 0.42665) * T + 2004.3109) * T * K_DEG / 3600.0;
  const sinth = Math.sin(TH);
  const costh = Math.cos(TH);
  const sinZ = Math.sin(Z);
  const cosZ = Math.cos(Z);
  const sinz = Math.sin(z);
  const cosz = Math.cos(z);
  const A = cosZ * costh;
  const B = sinZ * costh;
  const x0 = v[0];
  const x1 = v[1];
  const x2 = v[2];
  if (direction < 0) {
    v[0] = (A * cosz - sinZ * sinz) * x0 - (B * cosz + cosZ * sinz) * x1 - sinth * cosz * x2;
    v[1] = (A * sinz + sinZ * cosz) * x0 - (B * sinz - cosZ * cosz) * x1 - sinth * sinz * x2;
    v[2] = cosZ * sinth * x0 - sinZ * sinth * x1 + costh * x2;
  } else {
    v[0] = (A * cosz - sinZ * sinz) * x0 + (A * sinz + sinZ * cosz) * x1 + cosZ * sinth * x2;
    v[1] = -(B * cosz + cosZ * sinz) * x0 - (B * sinz - cosZ * cosz) * x1 - sinZ * sinth * x2;
    v[2] = -sinth * cosz * x0 - sinth * sinz * x1 + costh * x2;
  }
}

/** Equatorial cartesian to ecliptic cartesian. KP-Qt `astro::coortrf`. */
function coortrf(v: [number, number, number], eps: number): void {
  const s = Math.sin(eps);
  const c = Math.cos(eps);
  const y = v[1] * c + v[2] * s;
  const z = -v[1] * s + v[2] * c;
  v[1] = y;
  v[2] = z;
}

/**
 * Mean ayanamsa in degrees at Julian day `jdUt` (UT). KP-Qt `astro::ayanamsa`
 * for the six product sidereal modes.
 */
export function meanAyanamsaKpQt(jdUt: number, mode: KpQtTableAyanamsaMode): number {
  const { t0, ayanT0 } = KPQT_AYA_TABLE[mode];
  const tt = jdTt(jdUt);
  const x: [number, number, number] = [1.0, 0.0, 0.0];
  if (tt !== K_J2000) precess(x, tt, +1);
  precess(x, t0, -1);
  coortrf(x, meanObliquity(t0));
  const lon = Math.atan2(x[1], x[0]) * K_RAD;
  return norm360(-(lon - ayanT0));
}
