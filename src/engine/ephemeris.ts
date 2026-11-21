/**
 * Planetary ephemeris for the unified engine (work package `port-ephemeris`, #41).
 *
 * Sun to Saturn (and, behind an explicit option, Uranus, Neptune, Pluto) come from
 * astronomy-engine, which runs unchanged in Cloudflare Workers. Time, delta-T, nutation and
 * obliquity also come from astronomy-engine, so planets and Placidus cusps share one nutation
 * model.
 *
 * Frames and the ayanamsa correction:
 *  - Every `tropicalLongitude` here is measured from the TRUE equinox of date, so it contains the
 *    nutation in longitude (dPsi).
 *  - Sidereal longitude = tropical - (mean ayanamsa + dPsi). Subtracting the mean ayanamsa alone
 *    leaves the sidereal longitude off by exactly dPsi (up to ~18 arcsec, issue #33).
 *  - The mean ayanamsa is Stack A's polynomial (`calculateAyanamsa`), evaluated at TT.
 *
 * Lunar nodes:
 *  - Mean node: IAU polynomial for the mean longitude of the ascending node (mean equinox of date),
 *    with dPsi added so it is in the same true-equinox frame as every other body.
 *  - True node: from the instantaneous Earth-Moon state vector, with the orbital plane taken in the
 *    true ecliptic of date (issue #34: Stack B read it from a J2000 frame and was up to 41' off).
 *
 * Not ported from Stack B: `fetchJplHorizonsPosition` (a network call that always returned null).
 */

import * as Astronomy from 'astronomy-engine';
import { calculateAyanamsa, normalizeDegrees } from './astronomy.js';
import type { AyanamsaMode, ChartCalculationOptions, NodeMode, PlanetName } from './types.js';

/** Julian Day of the J2000.0 epoch. */
const JD_J2000 = 2451545.0;

/** Step used for the central-difference longitude speed: positions at t - h/2 and t + h/2. */
const SPEED_WINDOW_HOURS = 1;

/**
 * Explicit inputs. None of them has a default, because each is an open owner decision.
 *  - `ayanamsa`: TODO(#22) default KP ayanamsa.
 *  - `nodeMode`: TODO(#29 Q6) mean vs true node.
 *  - `includeOuterPlanets`: TODO(#29 Q12) whether Uranus, Neptune, Pluto are returned.
 */
export type EphemerisOptions = Pick<
  ChartCalculationOptions,
  'ayanamsa' | 'nodeMode' | 'includeOuterPlanets'
>;

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
  nodeMode: NodeMode;
  julianDayUt: number;
  julianDayTt: number;
  /** Mean ayanamsa (Stack A polynomial), degrees. */
  meanAyanamsaDeg: number;
  /** Mean ayanamsa + dPsi: the value actually subtracted from tropical longitudes, degrees. */
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
const OUTER_BODIES = ['Uranus', 'Neptune', 'Pluto'] as const;

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

/**
 * Longitude of the osculating (true) ascending node of the Moon, degrees 0-360, measured in the
 * TRUE ecliptic of date.
 *
 * The Moon's geocentric state vector comes from astronomy-engine in the J2000 mean equator frame
 * (EQJ). Position and velocity are both rotated into the true ecliptic of date (ECT) before the
 * orbital angular momentum h = r x v is formed. The ascending node is the direction z x h.
 */
export function calculateTrueLunarNode(time: Astronomy.AstroTime): number {
  const state = Astronomy.GeoMoonState(time);
  const rotation = Astronomy.Rotation_EQJ_ECT(time);
  const r = Astronomy.RotateVector(rotation, new Astronomy.Vector(state.x, state.y, state.z, time));
  const v = Astronomy.RotateVector(
    rotation,
    new Astronomy.Vector(state.vx, state.vy, state.vz, time)
  );

  // h = r x v. In the ecliptic frame the ascending node line is z x h = (-hy, hx, 0).
  const hx = r.y * v.z - r.z * v.y;
  const hy = r.z * v.x - r.x * v.z;

  return normalizeDegrees((Math.atan2(hx, -hy) * 180) / Math.PI);
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
  time: Astronomy.AstroTime,
  nodeMode: NodeMode
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
      const rahu =
        nodeMode === 'TRUE'
          ? calculateTrueLunarNode(time)
          : // Mean node is in the mean equinox of date; add dPsi to bring it to the true equinox.
            normalizeDegrees(
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
  if (mode !== 'kp_old' && mode !== 'kp_new') {
    // No silent fallback to KP Old or Lahiri.
    throw new Error(`Unsupported ayanamsa mode: ${String(mode)} (expected 'kp_old' or 'kp_new')`);
  }
}

function assertNodeMode(mode: NodeMode): void {
  if (mode !== 'MEAN' && mode !== 'TRUE') {
    throw new Error(`Unsupported node mode: ${String(mode)} (expected 'MEAN' or 'TRUE')`);
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
 * Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu and Ketu are always returned. Uranus,
 * Neptune and Pluto only when `options.includeOuterPlanets` is true.
 */
export function calculateEphemeris(date: Date, options: EphemerisOptions): EphemerisResult {
  assertAyanamsa(options.ayanamsa);
  assertNodeMode(options.nodeMode);

  const time = Astronomy.MakeTime(date);
  const julianDayUt = time.ut + JD_J2000;
  const julianDayTt = time.tt + JD_J2000;

  const tilt = Astronomy.e_tilt(time);
  const nutationInLongitudeDeg = tilt.dpsi / 3600.0; // arcsec -> degrees
  const nutationInObliquityDeg = tilt.deps / 3600.0;

  const meanAyanamsaDeg = calculateAyanamsa(julianDayTt, options.ayanamsa).meanAyanamsa;
  const trueAyanamsaDeg = meanAyanamsaDeg + nutationInLongitudeDeg;

  const halfWindowMs = (SPEED_WINDOW_HOURS * 3600 * 1000) / 2;
  const timeBefore = Astronomy.MakeTime(new Date(date.getTime() - halfWindowMs));
  const timeAfter = Astronomy.MakeTime(new Date(date.getTime() + halfWindowMs));

  const bodies: PlanetName[] = [
    ...CLASSICAL_BODIES,
    ...(options.includeOuterPlanets ? OUTER_BODIES : []),
  ];

  const planets: EphemerisPlanet[] = bodies.map((body) => {
    const now = tropicalCoordinates(body, time, options.nodeMode);
    const before = tropicalCoordinates(body, timeBefore, options.nodeMode);
    const after = tropicalCoordinates(body, timeAfter, options.nodeMode);

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
    nodeMode: options.nodeMode,
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
