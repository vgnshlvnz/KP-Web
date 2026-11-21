/**
 * Planetary ephemeris for the unified engine (work package `port-ephemeris`, #41).
 *
 * Sun to Saturn come from astronomy-engine (no Uranus, Neptune or Pluto: #29 (owner, 2026-11-21)), which runs unchanged in Cloudflare Workers. Time, delta-T, nutation and
 * obliquity also come from astronomy-engine, so planets and Placidus cusps share one nutation
 * model.
 *
 * Frames and the ayanamsa correction:
 *  - Every `tropicalLongitude` here is measured from the TRUE equinox of date, so it contains the
 *    nutation in longitude (dPsi).
 *  - Sidereal longitude = tropical - (mean ayanamsa + dPsi). Subtracting the mean ayanamsa alone
 *    leaves the sidereal longitude off by exactly dPsi (up to ~18 arcsec, issue #33).
 *  - The mean ayanamsa is `calculateAyanamsa` (Stack A's polynomial for KP Old / KP New, the
 *    Swiss Ephemeris definitions in `ayanamsa-defs.ts` for the others), evaluated at TT.
 *  - 'nil' (tropical) subtracts nothing: mean ayanamsa 0 and no dPsi term, so sidereal = tropical.
 *
 * Lunar nodes: MEAN node only (#29 (owner, 2026-11-21): "Use mean node only"). IAU polynomial for
 * the mean longitude of the ascending node (mean equinox of date), with dPsi added so it is in the
 * same true-equinox frame as every other body. There is no true-node code.
 *
 * Not ported from Stack B: `fetchJplHorizonsPosition` (a network call that always returned null).
 */

import * as Astronomy from 'astronomy-engine';
import { calculateAyanamsa, normalizeDegrees } from './astronomy.js';
import { isAyanamsaMode, unsupportedAyanamsaMessage } from './ayanamsa-defs.js';
import type { AyanamsaMode, ChartCalculationOptions, PlanetName } from './types.js';

/** Julian Day of the J2000.0 epoch. */
const JD_J2000 = 2451545.0;

/** Step used for the central-difference longitude speed: positions at t - h/2 and t + h/2. */
const SPEED_WINDOW_HOURS = 1;

/**
 * Explicit input. `ayanamsa` has no default, because it is an open owner decision: TODO(#22).
 */
export type EphemerisOptions = Pick<ChartCalculationOptions, 'ayanamsa'>;

export interface EphemerisPlanet {
  name: PlanetName;
  /** Longitude from the true equinox of date, degrees 0-360 (includes nutation). */
  tropicalLongitude: number;
  /** tropicalLongitude - (mean ayanamsa + dPsi), degrees 0-360. */
  siderealLongitude: number;
  /** Ecliptic latitude, degrees (0 for the nodes). */
  latitude: number;
  /** Geocentric distance in AU (a nominal lunar distance for the nodes). */
  distanceAu: number;
  /** Rate of change of the tropical longitude, degrees per day (central difference over one hour). */
  speedLongitudeDegPerDay: number;
  /** True when `speedLongitudeDegPerDay` is negative. */
  isRetrograde: boolean;
}

export interface EphemerisResult {
  planets: EphemerisPlanet[];
  ayanamsa: AyanamsaMode;
  julianDayUt: number;
  julianDayTt: number;
  /** Mean ayanamsa of the chosen mode, degrees (0 for 'nil'). */
  meanAyanamsaDeg: number;
  /** Mean ayanamsa + dPsi (0 for 'nil'): the value actually subtracted from tropical longitudes, degrees. */
  trueAyanamsaDeg: number;
  /** Nutation in longitude, degrees (astronomy-engine, IAU 2000B). */
  nutationInLongitudeDeg: number;
  /** Nutation in obliquity, degrees. */
  nutationInObliquityDeg: number;
  meanObliquityDeg: number;
  trueObliquityDeg: number;
}

/** Order the bodies are returned in (same as Stack B). */
const CLASSICAL_BODIES = [
  'Sun',
  'Moon',
  'Mars',
  'Mercury',
  'Jupiter',
  'Venus',
  'Saturn',
  'Rahu',
  'Ketu',
] as const;

/**
 * Mean longitude of the Moon's ascending node (mean Rahu), degrees 0-360, from the IAU
 * polynomial (Simon et al. 1994). Mean equinox of date.
 *
 * @param jd Julian Day. Pass TT for full accuracy; UT differs by under 0.2 arcsec.
 */
export function calculateMeanLunarNode(jd: number): number {
  const T = (jd - JD_J2000) / 36525.0;
  const omega =
    125.04455501 -
    1934.1361849 * T +
    0.0020762 * T * T +
    (T * T * T) / 467410.0 -
    (T * T * T * T) / 60616000.0;
  return normalizeDegrees(omega);
}

interface TropicalCoordinates {
  lon: number;
  lat: number;
  dist: number;
}

/** Nominal Earth-Moon distance in AU, reported for the (massless) nodes. */
const NODE_DISTANCE_AU = 0.00257;

function tropicalCoordinates(
  body: PlanetName,
  time: Astronomy.AstroTime
): TropicalCoordinates {
  switch (body) {
    case 'Sun': {
      const sun = Astronomy.SunPosition(time);
      return { lon: sun.elon, lat: sun.elat, dist: sun.vec.Length() };
    }
    case 'Moon': {
      const moon = Astronomy.EclipticGeoMoon(time);
      return { lon: moon.lon, lat: moon.lat, dist: moon.dist };
    }
    case 'Rahu':
    case 'Ketu': {
      // Mean node is in the mean equinox of date; add dPsi to bring it to the true equinox.
      const rahu = normalizeDegrees(
        calculateMeanLunarNode(time.tt + JD_J2000) + Astronomy.e_tilt(time).dpsi / 3600.0
      );
      const lon = body === 'Rahu' ? rahu : normalizeDegrees(rahu + 180.0);
      return { lon, lat: 0, dist: NODE_DISTANCE_AU };
    }
    default: {
      const astroBody = Astronomy.Body[body as keyof typeof Astronomy.Body];
      if (!astroBody) {
        throw new Error(`Unsupported body: ${body}`);
      }
      // GeoVector is in EQJ; Ecliptic() rotates it to the true ecliptic of date.
      const sphere = Astronomy.Ecliptic(Astronomy.GeoVector(astroBody, time, true));
      return { lon: sphere.elon, lat: sphere.elat, dist: sphere.vec.Length() };
    }
  }
}

function assertAyanamsa(mode: AyanamsaMode): void {
  if (!isAyanamsaMode(mode)) {
    // No silent fallback to KP Old or Lahiri.
    throw new Error(unsupportedAyanamsaMessage(mode));
  }
}

/** Signed difference a - b wrapped into (-180, 180]. */
function wrapDelta(a: number, b: number): number {
  let d = a - b;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

/**
 * Sidereal longitudes, speeds and retrograde flags for the KP bodies at a UTC instant.
 *
 * Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu (mean node) and Ketu are returned.
 */
export function calculateEphemeris(date: Date, options: EphemerisOptions): EphemerisResult {
  assertAyanamsa(options.ayanamsa);

  const time = Astronomy.MakeTime(date);
  const julianDayUt = time.ut + JD_J2000;
  const julianDayTt = time.tt + JD_J2000;

  const tilt = Astronomy.e_tilt(time);
  const nutationInLongitudeDeg = tilt.dpsi / 3600.0; // arcsec -> degrees
  const nutationInObliquityDeg = tilt.deps / 3600.0;

  // mean + dPsi for every mode except 'nil' (tropical), where both are 0.
  const ayanamsa = calculateAyanamsa(julianDayTt, options.ayanamsa, nutationInLongitudeDeg);
  const meanAyanamsaDeg = ayanamsa.meanAyanamsa;
  const trueAyanamsaDeg = ayanamsa.trueAyanamsa;

  const halfWindowMs = (SPEED_WINDOW_HOURS * 3600 * 1000) / 2;
  const timeBefore = Astronomy.MakeTime(new Date(date.getTime() - halfWindowMs));
  const timeAfter = Astronomy.MakeTime(new Date(date.getTime() + halfWindowMs));

  const planets: EphemerisPlanet[] = CLASSICAL_BODIES.map((body) => {
    const now = tropicalCoordinates(body, time);
    const before = tropicalCoordinates(body, timeBefore);
    const after = tropicalCoordinates(body, timeAfter);

    const speedDegPerDay = (wrapDelta(after.lon, before.lon) / SPEED_WINDOW_HOURS) * 24;

    return {
      name: body,
      tropicalLongitude: now.lon,
      siderealLongitude: normalizeDegrees(now.lon - trueAyanamsaDeg),
      latitude: now.lat,
      distanceAu: now.dist,
      speedLongitudeDegPerDay: speedDegPerDay,
      isRetrograde: speedDegPerDay < 0,
    };
  });

  return {
    planets,
    ayanamsa: options.ayanamsa,
    julianDayUt,
    julianDayTt,
    meanAyanamsaDeg,
    trueAyanamsaDeg,
    nutationInLongitudeDeg,
    nutationInObliquityDeg,
    meanObliquityDeg: tilt.mobl,
    trueObliquityDeg: tilt.tobl,
  };
}
