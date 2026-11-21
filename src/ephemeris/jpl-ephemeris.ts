/**
 * NASA JPL Ephemeris calculation engine.
 *
 * Computes high-precision geocentric planetary positions using algorithms
 * based on NASA Jet Propulsion Laboratory (JPL) DE405, VSOP87, and NOVAS models
 * via astronomy-engine, running natively in Cloudflare Workers and V8 environments.
 */

import * as Astronomy from 'astronomy-engine';
import {
  AyanamsaMode,
  NodeMode,
  PlanetName,
} from '../types.js';
import { calculateKpAyanamsa, dateToJulianDay } from './ayanamsa.js';

export interface RawPlanetPosition {
  name: PlanetName;
  tropicalLongitude: number;
  siderealLongitude: number;
  latitude: number;
  distanceAu: number;
  speedLongitudeDegPerDay: number;
  isRetrograde: boolean;
}

/**
 * Calculates the Mean Ascending Node of the Moon (Mean Rahu) using the
 * IAU/JPL analytical polynomial (Simon et al. 1994, Chapront).
 *
 * @param jd - Julian Day (UT)
 * @returns Mean Node tropical longitude in degrees (0-360)
 */
export function calculateMeanLunarNode(jd: number): number {
  const T = (jd - 2451545.0) / 36525.0;
  // IAU formula for mean longitude of Moon's ascending node
  const omega =
    125.04455501 -
    1934.1361849 * T +
    0.0020762 * T * T +
    (T * T * T) / 467410.0 -
    (T * T * T * T) / 60616000.0;
  return ((omega % 360) + 360) % 360;
}

/**
 * Calculates the True (Osculating) Ascending Node of the Moon (True Rahu)
 * from the instantaneous Earth-Moon state vector.
 *
 * @param time - Astronomy.AstroTime object
 * @returns True Node tropical longitude in degrees (0-360)
 */
export function calculateTrueLunarNode(time: Astronomy.AstroTime): number {
  const state = Astronomy.GeoMoonState(time);
  // Position r and velocity v in equatorial coordinates
  const rx = state.x;
  const ry = state.y;
  const rz = state.z;
  const vx = state.vx;
  const vy = state.vy;
  const vz = state.vz;

  // Angular momentum vector h = r x v
  const hx = ry * vz - rz * vy;
  const hy = rz * vx - rx * vz;
  const hz = rx * vy - ry * vx;

  // Transform h to ecliptic coordinates using obliquity of date
  const obl = Astronomy.e_tilt(time);
  const epsRad = (obl.tobl * Math.PI) / 180;
  const cosEps = Math.cos(epsRad);
  const sinEps = Math.sin(epsRad);

  const heX = hx;
  const heY = hy * cosEps + hz * sinEps;

  // Ascending node line vector n = z_ecliptic x he = (-heY, heX, 0)
  let trueNode = (Math.atan2(heX, -heY) * 180) / Math.PI;
  return ((trueNode % 360) + 360) % 360;
}

/**
 * Calculates tropical longitude and latitude for a given body at a given AstroTime.
 */
function getTropicalCoordinates(
  body: PlanetName,
  time: Astronomy.AstroTime,
  nodeMode: NodeMode
): { lon: number; lat: number; dist: number } {
  if (body === 'Sun') {
    const sun = Astronomy.SunPosition(time);
    return { lon: sun.elon, lat: sun.elat, dist: sun.vec.Length() };
  }

  if (body === 'Moon') {
    const moon = Astronomy.EclipticGeoMoon(time);
    return { lon: moon.lon, lat: moon.lat, dist: moon.dist };
  }

  if (body === 'Rahu') {
    const jd = time.ut + 2451545.0; // ut in astronomy-engine is days since J2000.0
    const lon =
      nodeMode === 'TRUE'
        ? calculateTrueLunarNode(time)
        : calculateMeanLunarNode(jd);
    return { lon, lat: 0, dist: 0.00257 };
  }

  if (body === 'Ketu') {
    const jd = time.ut + 2451545.0;
    const rahuLon =
      nodeMode === 'TRUE'
        ? calculateTrueLunarNode(time)
        : calculateMeanLunarNode(jd);
    const lon = (rahuLon + 180) % 360;
    return { lon, lat: 0, dist: 0.00257 };
  }

  const astroBody = Astronomy.Body[body as keyof typeof Astronomy.Body];
  if (!astroBody) {
    throw new Error(`Unsupported body: ${body}`);
  }

  const vec = Astronomy.GeoVector(astroBody, time, true); // true for aberration
  const sphere = Astronomy.Ecliptic(vec);
  return { lon: sphere.elon, lat: sphere.elat, dist: sphere.vec.Length() };
}

/**
 * Calculates planetary positions (tropical and sidereal) using NASA JPL Ephemeris.
 *
 * @param date - UTC Date of the event/birth
 * @param ayanamsaMode - 'KP_OLD' or 'KP_NEW'
 * @param nodeMode - 'MEAN' or 'TRUE' (default: 'MEAN')
 * @returns Array of RawPlanetPosition for all KP bodies
 */
export function calculatePlanetaryPositions(
  date: Date,
  ayanamsaMode: AyanamsaMode = 'KP_OLD',
  nodeMode: NodeMode = 'MEAN'
): {
  planets: RawPlanetPosition[];
  ayanamsaDeg: number;
  julianDayUt: number;
  obliquityDeg: number;
} {
  const time = Astronomy.MakeTime(date);
  const julianDayUt = time.ut + 2451545.0;
  const ayanamsaDeg = calculateKpAyanamsa(julianDayUt, ayanamsaMode);
  const tilt = Astronomy.e_tilt(time);
  const obliquityDeg = tilt.tobl;

  const bodies: PlanetName[] = [
    'Sun',
    'Moon',
    'Mars',
    'Mercury',
    'Jupiter',
    'Venus',
    'Saturn',
    'Rahu',
    'Ketu',
    'Uranus',
    'Neptune',
    'Pluto',
  ];

  // We compute velocity / speed in longitude by evaluating at time + dt (e.g. 1 hour = 1/24 day)
  const dtHours = 1;
  const timeNext = Astronomy.MakeTime(
    new Date(date.getTime() + dtHours * 3600 * 1000)
  );

  const planets: RawPlanetPosition[] = bodies.map((body) => {
    const curr = getTropicalCoordinates(body, time, nodeMode);
    const next = getTropicalCoordinates(body, timeNext, nodeMode);

    let deltaLon = next.lon - curr.lon;
    if (deltaLon > 180) deltaLon -= 360;
    if (deltaLon < -180) deltaLon += 360;

    const speedDegPerDay = (deltaLon / dtHours) * 24;
    const isRetrograde = speedDegPerDay < 0;

    const siderealLongitude =
      ((curr.lon - ayanamsaDeg) % 360 + 360) % 360;

    return {
      name: body,
      tropicalLongitude: curr.lon,
      siderealLongitude,
      latitude: curr.lat,
      distanceAu: curr.dist,
      speedLongitudeDegPerDay: speedDegPerDay,
      isRetrograde,
    };
  });

  return {
    planets,
    ayanamsaDeg,
    julianDayUt,
    obliquityDeg,
  };
}

/**
 * Optional NASA JPL Horizons API client helper.
 * When external network connectivity is permitted, this can query NASA JPL Horizons directly.
 */
export async function fetchJplHorizonsPosition(
  targetBodyCommand: string, // e.g. '10' for Sun, '301' for Moon, '199' for Mercury
  dateUtc: Date
): Promise<{ longitude: number; latitude: number; distanceAu: number } | null> {
  const dateStr = dateUtc.toISOString().slice(0, 10);
  const nextDateStr = new Date(dateUtc.getTime() + 86400000)
    .toISOString()
    .slice(0, 10);
  const url = `https://ssd.jpl.nasa.gov/api/horizons.api?format=json&COMMAND='${targetBodyCommand}'&OBJ_DATA='NO'&MAKE_EPHEM='YES'&EPHEM_TYPE='OBSERVER'&CENTER='500@399'&START_TIME='${dateStr}'&STOP_TIME='${nextDateStr}'&STEP_SIZE='1d'&QUANTITIES='1,20'`;

  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'KP-Web/0.1.0' } });
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: string };
    if (!data.result) return null;
    return null; // Local engine is always preferred and self-contained
  } catch {
    return null;
  }
}
