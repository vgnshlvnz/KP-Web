/**
 * KP Unified Chart Engine Module.
 *
 * Computes natal, event, and horary KP charts with sidereal positions,
 * Placidus house cusps, sign/star/sub/sub-sub lords, 4-level significators,
 * ruling planets, and Vimshottari dasha.
 */

import {
  AyanamsaMode,
  ChartCalculationResult,
  Coordinates,
  DateTimeInput,
  HouseCusp,
  NodeMode,
  PlanetaryPosition,
} from '../types.js';
import { formatDms } from '../ephemeris/ayanamsa.js';
import { calculatePlanetaryPositions } from '../ephemeris/jpl-ephemeris.js';
import {
  calculateRamc,
  calculateTropicalPlacidusCusps,
  degNorm,
  getCuspalHouse,
} from '../houses/placidus.js';
import { calculateVimshottariDasha } from './dasha.js';
import { calculateRulingPlanets } from './ruling-planets.js';
import { calculateSignificators } from './significators.js';
import { calculateKpLords } from './sub-lords.js';

export interface NatalChartOptions {
  dateTime: DateTimeInput;
  coordinates: Coordinates;
  ayanamsaMode?: AyanamsaMode; // default: 'KP_OLD'
  nodeMode?: NodeMode; // default: 'MEAN'
  boundaryThresholdArcsec?: number;
}

/**
 * Converts DateTimeInput to UTC Date.
 */
export function dateTimeInputToUtcDate(dt: DateTimeInput): Date {
  // Validate input
  if (
    dt.year < -4000 ||
    dt.year > 4000 ||
    dt.month < 1 ||
    dt.month > 12 ||
    dt.day < 1 ||
    dt.day > 31 ||
    dt.hour < 0 ||
    dt.hour > 23 ||
    dt.minute < 0 ||
    dt.minute > 59 ||
    dt.second < 0 ||
    dt.second > 59
  ) {
    throw new Error(
      `Invalid date/time input: ${JSON.stringify(dt)}. Time must be specified to the second.`
    );
  }

  // Offset in milliseconds: local time - offset = UTC time
  const offsetMs = dt.timezoneOffsetHours * 3600 * 1000;
  const localMs = Date.UTC(
    dt.year,
    dt.month - 1,
    dt.day,
    dt.hour,
    dt.minute,
    dt.second
  );
  return new Date(localMs - offsetMs);
}

/**
 * Computes a full natal or event KP chart.
 */
export function calculateNatalChart(
  options: NatalChartOptions
): ChartCalculationResult {
  const {
    dateTime,
    coordinates,
    ayanamsaMode = 'KP_OLD',
    nodeMode = 'MEAN',
    boundaryThresholdArcsec = 60,
  } = options;

  if (
    coordinates.latitude < -90 ||
    coordinates.latitude > 90 ||
    coordinates.longitude < -180 ||
    coordinates.longitude > 180
  ) {
    throw new Error(
      `Invalid coordinates: latitude must be [-90, 90], longitude [-180, 180]. Received: ${JSON.stringify(coordinates)}`
    );
  }

  const dateUtc = dateTimeInputToUtcDate(dateTime);

  // 1. Calculate planetary positions with NASA JPL Ephemeris & KP Ayanamsa
  const { planets: rawPlanets, ayanamsaDeg, julianDayUt, obliquityDeg } =
    calculatePlanetaryPositions(dateUtc, ayanamsaMode, nodeMode);

  // 2. Calculate RAMC & Local Sidereal Time
  const { ramcDeg, lstHours } = calculateRamc(
    dateUtc,
    coordinates.longitude
  );

  // 3. Calculate Placidus house cusps
  const tropicalCusps = calculateTropicalPlacidusCusps(
    ramcDeg,
    coordinates.latitude,
    obliquityDeg
  );

  const siderealCuspsDeg = tropicalCusps.map((c) =>
    degNorm(c - ayanamsaDeg)
  );

  const warnings: string[] = [];

  // Build House Cusp objects with KP lords
  const houses: HouseCusp[] = tropicalCusps.map((tropCusp, idx) => {
    const houseNumber = idx + 1;
    const sidLon = siderealCuspsDeg[idx];
    const lords = calculateKpLords(sidLon, boundaryThresholdArcsec);

    if (lords.isNearSubBoundary) {
      warnings.push(
        `House ${houseNumber} cusp (${formatDms(sidLon)}) is within ${lords.distanceFromSubStartArcsec.toFixed(0)}" of start / ${lords.distanceToSubEndArcsec.toFixed(0)}" of end of its sub.`
      );
    }

    return {
      houseNumber,
      siderealLongitude: sidLon,
      tropicalLongitude: tropCusp,
      ...lords,
    };
  });

  const ascendant = houses[0];
  const mc = houses[9];

  // Assign cuspal houses to planets and calculate lords
  const planets: PlanetaryPosition[] = rawPlanets.map((p) => {
    const house = getCuspalHouse(p.siderealLongitude, siderealCuspsDeg);
    const lords = calculateKpLords(p.siderealLongitude, boundaryThresholdArcsec);

    if (lords.isNearSubBoundary) {
      warnings.push(
        `Planet ${p.name} (${formatDms(p.siderealLongitude)}) is close to sub boundary (${lords.distanceFromSubStartArcsec.toFixed(0)}" / ${lords.distanceToSubEndArcsec.toFixed(0)}").`
      );
    }

    return {
      ...p,
      house,
      ...lords,
    };
  });

  // Significators
  const significators = calculateSignificators(planets, houses);

  // Ruling Planets
  const moon = planets.find((p) => p.name === 'Moon')!;
  const rulingPlanets = calculateRulingPlanets(
    ascendant,
    moon,
    dateUtc,
    coordinates
  );

  // Vimshottari Dasha
  const dashaBalance = calculateVimshottariDasha(
    moon.siderealLongitude,
    dateUtc
  );

  return {
    engine: 'NASA JPL Ephemeris (Cloudflare Wrangler Worker)',
    ayanamsaMode,
    ayanamsaValueDeg: ayanamsaDeg,
    ayanamsaDms: formatDms(ayanamsaDeg, true),
    julianDayUt,
    localSiderealTimeDeg: lstHours * 15,
    ramcDeg,
    obliquityDeg,
    planets,
    houses,
    ascendant,
    mc,
    significators,
    rulingPlanets,
    dashaBalance,
    warnings,
  };
}
