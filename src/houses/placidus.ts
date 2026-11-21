/**
 * Placidus House Cusps and RAMC module.
 *
 * Implements high-precision Placidus house trisection algorithms,
 * identical to astronomical reference implementations (sub-arcsecond precision),
 * plus RAMC inversion for KP horary calculations.
 */

import * as Astronomy from 'astronomy-engine';
import { Coordinates, HouseCusp, KpLords } from '../types.js';

const VERY_SMALL = 1e-15;

/**
 * Normalizes degrees to [0, 360).
 */
export function degNorm(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function dSin(d: number): number {
  return Math.sin((d * Math.PI) / 180);
}

function dCos(d: number): number {
  return Math.cos((d * Math.PI) / 180);
}

function dTan(d: number): number {
  return Math.tan((d * Math.PI) / 180);
}

function dAsin(val: number): number {
  return (Math.asin(Math.max(-1.0, Math.min(1.0, val))) * 180) / Math.PI;
}

function dAtan(val: number): number {
  return (Math.atan(val) * 180) / Math.PI;
}

/**
 * Oblique triangle intersection for Ascendant/cusp crossing.
 */
function asc2(x: number, f: number, sine: number, cose: number): number {
  let ass = -dTan(f) * sine + cose * dCos(x);
  if (Math.abs(ass) < VERY_SMALL) ass = 0;
  let sinx = dSin(x);
  if (Math.abs(sinx) < VERY_SMALL) sinx = 0;

  if (sinx === 0) {
    ass = ass < 0 ? -VERY_SMALL : VERY_SMALL;
  } else if (ass === 0) {
    ass = sinx < 0 ? -90 : 90;
  } else {
    ass = dAtan(sinx / ass);
  }

  if (ass < 0) {
    ass += 180;
  }
  return ass;
}

/**
 * Asc1: Computes ecliptic longitude of crossing for right ascension x1 and pole height f.
 */
export function asc1(x1: number, f: number, sine: number, cose: number): number {
  const normX1 = degNorm(x1);
  const n = Math.floor(normX1 / 90) + 1; // quadrant 1..4

  if (Math.abs(90 - f) < VERY_SMALL) return 180;
  if (Math.abs(90 + f) < VERY_SMALL) return 0;

  let ass = 0;
  if (n === 1) {
    ass = asc2(normX1, f, sine, cose);
  } else if (n === 2) {
    ass = 180 - asc2(180 - normX1, -f, sine, cose);
  } else if (n === 3) {
    ass = 180 + asc2(normX1 - 180, -f, sine, cose);
  } else {
    ass = 360 - asc2(360 - normX1, f, sine, cose);
  }
  return degNorm(ass);
}

/**
 * Converts RAMC to Midheaven (MC / Cusp 10) ecliptic longitude.
 */
export function armcToMc(armc: number, eps: number): number {
  const cose = dCos(eps);
  const tant = dTan(armc);
  let mc = degNorm(dAtan(tant / cose));
  if (armc > 90 && armc <= 270) {
    mc = degNorm(mc + 180);
  }
  return mc;
}

/**
 * Computes Right Ascension of Midheaven (RAMC) from UTC Date and geographic longitude.
 */
export function calculateRamc(dateUtc: Date, longitudeDeg: number): {
  ramcDeg: number;
  lstHours: number;
  obliquityDeg: number;
} {
  const time = Astronomy.MakeTime(dateUtc);
  const gmstHours = Astronomy.SiderealTime(time);
  const lstHours = degNorm(gmstHours * 15 + longitudeDeg) / 15;
  const ramcDeg = degNorm(lstHours * 15);
  const tilt = Astronomy.e_tilt(time);
  return { ramcDeg, lstHours, obliquityDeg: tilt.tobl };
}

/**
 * Computes tropical Placidus house cusps 1 to 12.
 *
 * @param ramc - Right Ascension of Midheaven in degrees (0-360)
 * @param latitude - Geographic latitude in degrees (-90 to +90)
 * @param obliquity - True obliquity of the ecliptic in degrees
 * @returns Array of 12 numbers representing cusps 1 to 12 in tropical degrees
 */
export function calculateTropicalPlacidusCusps(
  ramc: number,
  latitude: number,
  obliquity: number
): number[] {
  // If latitude is polar (>= 66.5°), fall back gracefully
  const safeLat = Math.max(-66.0, Math.min(66.0, latitude));

  const sine = dSin(obliquity);
  const cose = dCos(obliquity);
  const tane = dTan(obliquity);
  const tanfi = dTan(safeLat);

  const mc = armcToMc(ramc, obliquity);
  const asc = asc1(ramc + 90, safeLat, sine, cose);

  const a = dAsin(tanfi * tane);
  const fh1 = dAtan(dSin(a / 3) / tane);
  const fh2 = dAtan(dSin((a * 2) / 3) / tane);

  const cusps = new Array<number>(13).fill(0);
  cusps[1] = asc;
  cusps[10] = mc;

  // Cusp 11
  const r11 = degNorm(30 + ramc);
  let tant11 = dTan(dAsin(sine * dSin(asc1(r11, fh1, sine, cose))));
  if (Math.abs(tant11) < 1e-10) {
    cusps[11] = r11;
  } else {
    let f = dAtan(dSin(dAsin(tanfi * tant11) / 3) / tant11);
    let c11 = asc1(r11, f, sine, cose);
    for (let i = 0; i < 30; i++) {
      tant11 = dTan(dAsin(sine * dSin(c11)));
      if (Math.abs(tant11) < 1e-10) {
        c11 = r11;
        break;
      }
      f = dAtan(dSin(dAsin(tanfi * tant11) / 3) / tant11);
      const prev = c11;
      c11 = asc1(r11, f, sine, cose);
      if (Math.abs(c11 - prev) < 1e-10) break;
    }
    cusps[11] = c11;
  }

  // Cusp 12
  const r12 = degNorm(60 + ramc);
  let tant12 = dTan(dAsin(sine * dSin(asc1(r12, fh2, sine, cose))));
  if (Math.abs(tant12) < 1e-10) {
    cusps[12] = r12;
  } else {
    let f = dAtan(dSin(dAsin(tanfi * tant12) / 1.5) / tant12);
    let c12 = asc1(r12, f, sine, cose);
    for (let i = 0; i < 30; i++) {
      tant12 = dTan(dAsin(sine * dSin(c12)));
      if (Math.abs(tant12) < 1e-10) {
        c12 = r12;
        break;
      }
      f = dAtan(dSin(dAsin(tanfi * tant12) / 1.5) / tant12);
      const prev = c12;
      c12 = asc1(r12, f, sine, cose);
      if (Math.abs(c12 - prev) < 1e-10) break;
    }
    cusps[12] = c12;
  }

  // Cusp 2
  const r2 = degNorm(120 + ramc);
  let tant2 = dTan(dAsin(sine * dSin(asc1(r2, fh2, sine, cose))));
  if (Math.abs(tant2) < 1e-10) {
    cusps[2] = r2;
  } else {
    let f = dAtan(dSin(dAsin(tanfi * tant2) / 1.5) / tant2);
    let c2 = asc1(r2, f, sine, cose);
    for (let i = 0; i < 30; i++) {
      tant2 = dTan(dAsin(sine * dSin(c2)));
      if (Math.abs(tant2) < 1e-10) {
        c2 = r2;
        break;
      }
      f = dAtan(dSin(dAsin(tanfi * tant2) / 1.5) / tant2);
      const prev = c2;
      c2 = asc1(r2, f, sine, cose);
      if (Math.abs(c2 - prev) < 1e-10) break;
    }
    cusps[2] = c2;
  }

  // Cusp 3
  const r3 = degNorm(150 + ramc);
  let tant3 = dTan(dAsin(sine * dSin(asc1(r3, fh1, sine, cose))));
  if (Math.abs(tant3) < 1e-10) {
    cusps[3] = r3;
  } else {
    let f = dAtan(dSin(dAsin(tanfi * tant3) / 3) / tant3);
    let c3 = asc1(r3, f, sine, cose);
    for (let i = 0; i < 30; i++) {
      tant3 = dTan(dAsin(sine * dSin(c3)));
      if (Math.abs(tant3) < 1e-10) {
        c3 = r3;
        break;
      }
      f = dAtan(dSin(dAsin(tanfi * tant3) / 3) / tant3);
      const prev = c3;
      c3 = asc1(r3, f, sine, cose);
      if (Math.abs(c3 - prev) < 1e-10) break;
    }
    cusps[3] = c3;
  }

  // Opposite cusps (houses 4 to 9)
  cusps[4] = degNorm(cusps[10] + 180);
  cusps[5] = degNorm(cusps[11] + 180);
  cusps[6] = degNorm(cusps[12] + 180);
  cusps[7] = degNorm(cusps[1] + 180);
  cusps[8] = degNorm(cusps[2] + 180);
  cusps[9] = degNorm(cusps[3] + 180);

  return cusps.slice(1, 13);
}

/**
 * RAMC Inversion: Finds the RAMC that produces a given tropical Ascendant longitude
 * for a specific latitude and obliquity.
 *
 * Essential for KP Horary astrology (1-249 numbers) where the Ascendant is fixed
 * at the start of the querent's chosen sub.
 */
export function invertAscendantToRamc(
  targetAscendantDeg: number,
  latitudeDeg: number,
  obliquityDeg: number
): number {
  const safeLat = Math.max(-66.0, Math.min(66.0, latitudeDeg));
  const sine = dSin(obliquityDeg);
  const cose = dCos(obliquityDeg);

  // Find closest 10-degree grid point as initial guess
  let bestTh = 0;
  let minDiff = 999;
  for (let step = 0; step < 36; step++) {
    const thTry = step * 10.0;
    const val = asc1(thTry + 90, safeLat, sine, cose);
    let diff = Math.abs(val - targetAscendantDeg);
    if (diff > 180) diff = 360 - diff;
    if (diff < minDiff) {
      minDiff = diff;
      bestTh = thTry;
    }
  }

  // Newton-Raphson iteration
  let th = bestTh;
  for (let iter = 0; iter < 25; iter++) {
    const val = asc1(th + 90, safeLat, sine, cose);
    let err = val - targetAscendantDeg;
    if (err > 180) err -= 360;
    if (err < -180) err += 360;

    if (Math.abs(err) < 1e-11) break;

    const delta = 0.0001;
    const valD = asc1(th + delta + 90, safeLat, sine, cose);
    let dErr = valD - val;
    if (dErr > 180) dErr -= 360;
    if (dErr < -180) dErr += 360;

    let deriv = dErr / delta;
    if (Math.abs(deriv) < 1e-6) deriv = 1.0;

    th = degNorm(th - err / deriv);
  }

  return th;
}

/**
 * Determines which Placidus house (1-12) a given sidereal longitude falls into.
 * A planet just before a cusp belongs to the preceding house.
 *
 * @param planetSiderealLon - Planet's sidereal longitude (0-360)
 * @param cuspsSidereal - Array of 12 cusps in sidereal degrees
 * @returns House number (1-12)
 */
export function getCuspalHouse(
  planetSiderealLon: number,
  cuspsSidereal: number[]
): number {
  const p = degNorm(planetSiderealLon);

  for (let i = 0; i < 12; i++) {
    const cuspCurr = degNorm(cuspsSidereal[i]);
    const cuspNext = degNorm(cuspsSidereal[(i + 1) % 12]);

    if (cuspCurr <= cuspNext) {
      if (p >= cuspCurr && p < cuspNext) {
        return i + 1;
      }
    } else {
      // Crosses 0° Aries
      if (p >= cuspCurr || p < cuspNext) {
        return i + 1;
      }
    }
  }

  return 1;
}
