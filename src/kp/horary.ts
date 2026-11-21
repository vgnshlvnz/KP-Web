/**
 * KP Horary (Prashna) 1–249 Calculation Module.
 *
 * Implements canonical KP Horary rules:
 * - Querent picks a number 1 to 249
 * - Lagna is fixed at the START of the chosen sub (or midpoint if toggle enabled)
 * - RAMC inversion computes the sidereal time and Placidus cusps for that Lagna
 * - Planetary positions are taken from the question's actual time and location
 */

import {
  AyanamsaMode,
  Coordinates,
  HoraryCalculationResult,
  HouseCusp,
  NodeMode,
  PlanetaryPosition,
} from '../types.js';
import { calculateKpAyanamsa, formatDms } from '../ephemeris/ayanamsa.js';
import { calculatePlanetaryPositions } from '../ephemeris/jpl-ephemeris.js';
import {
  calculateTropicalPlacidusCusps,
  degNorm,
  getCuspalHouse,
  invertAscendantToRamc,
} from '../houses/placidus.js';
import { calculateVimshottariDasha } from './dasha.js';
import { getHoraryEntry } from './horary-table.js';
import { calculateRulingPlanets } from './ruling-planets.js';
import { calculateSignificators } from './significators.js';
import { calculateKpLords } from './sub-lords.js';

export interface HoraryCalculationOptions {
  horaryNumber: number; // 1-249
  dateUtc: Date;
  coordinates: Coordinates;
  ayanamsaMode?: AyanamsaMode; // default 'KP_OLD'
  useSubMidpoint?: boolean; // default false (start of sub)
  nodeMode?: NodeMode; // default 'MEAN'
  boundaryThresholdArcsec?: number;
}

/**
 * Computes a complete KP Horary Chart for a chosen number 1–249.
 */
export function calculateHoraryChart(
  options: HoraryCalculationOptions
): HoraryCalculationResult {
  const {
    horaryNumber,
    dateUtc,
    coordinates,
    ayanamsaMode = 'KP_OLD',
    useSubMidpoint = false,
    nodeMode = 'MEAN',
    boundaryThresholdArcsec = 60,
  } = options;

  const entry = getHoraryEntry(horaryNumber);

  // Target sidereal Lagna: default is START of sub; toggle enables midpoint
  const lagnaTargetDeg = useSubMidpoint
    ? (entry.startLongitude + entry.endLongitude) / 2
    : entry.startLongitude;

  // 1. Calculate planets at question time
  const { planets: rawPlanets, ayanamsaDeg, julianDayUt, obliquityDeg } =
    calculatePlanetaryPositions(dateUtc, ayanamsaMode, nodeMode);

  // 2. Convert target sidereal Lagna to tropical
  const targetTropicalLagna = degNorm(lagnaTargetDeg + ayanamsaDeg);

  // 3. RAMC Inversion: find the RAMC producing this Ascendant
  const invertedRamcDeg = invertAscendantToRamc(
    targetTropicalLagna,
    coordinates.latitude,
    obliquityDeg
  );

  // 4. Build Placidus house cusps from inverted RAMC
  const tropicalCusps = calculateTropicalPlacidusCusps(
    invertedRamcDeg,
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
        `House ${houseNumber} cusp (${formatDms(sidLon)}) is near sub boundary (within ${lords.distanceFromSubStartArcsec.toFixed(0)}" of start / ${lords.distanceToSubEndArcsec.toFixed(0)}" of end).`
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

  // Assign cuspal houses to planets
  const planets: PlanetaryPosition[] = rawPlanets.map((p) => {
    const house = getCuspalHouse(p.siderealLongitude, siderealCuspsDeg);
    const lords = calculateKpLords(p.siderealLongitude, boundaryThresholdArcsec);

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
    localSiderealTimeDeg: invertedRamcDeg,
    ramcDeg: invertedRamcDeg,
    obliquityDeg,
    planets,
    houses,
    ascendant,
    mc,
    significators,
    rulingPlanets,
    dashaBalance,
    warnings,
    horaryNumber,
    horarySubStartDeg: entry.startLongitude,
    horarySubEndDeg: entry.endLongitude,
    lagnaTargetDeg,
    useSubMidpoint,
    invertedRamcDeg,
  };
}
