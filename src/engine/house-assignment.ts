import { normalizeDegrees } from './astronomy.js';
import {
  PlanetInput,
  PlanetHouseAssignment,
  SubBoundaryInfo,
  SubSubBoundaryInfo,
} from './types.js';
import { getPositionLords, PositionLordsOptions } from './kp-lords.js';

/**
 * Checks whether a given longitude falls within the span of house [cusp, nextCusp).
 * Correctly handles the 360° / 0° (Aries 0°) wrap-around.
 */
export function isInHouse(
  longitude: number,
  cusp: number,
  nextCusp: number
): boolean {
  const lon = normalizeDegrees(longitude);
  const c = normalizeDegrees(cusp);
  const nc = normalizeDegrees(nextCusp);

  if (nc > c) {
    return lon >= c && lon < nc;
  } else {
    // Crosses 360° / 0°
    return lon >= c || lon < nc;
  }
}

/**
 * Determines which house (1 to 12) a given longitude belongs to, based on Placidus cusps.
 *
 * In KP astrology:
 * - A planet's house comes from the CUSPS, not its zodiac sign.
 * - A planet is assigned to the house of the cusp it has passed.
 * - A planet whose longitude is immediately before a cusp is in the previous house.
 *
 * @param longitude Sidereal longitude (0° to 360°)
 * @param cusps Array of 12 cusps [cusp1, cusp2, ..., cusp12] in degrees
 * @returns House number (1 to 12)
 */
export function getHouseForLongitude(
  longitude: number,
  cusps: number[]
): number {
  if (cusps.length !== 12) {
    throw new Error(`Expected 12 cusps, got ${cusps.length}`);
  }

  const lon = normalizeDegrees(longitude);

  for (let i = 0; i < 12; i++) {
    const cusp = cusps[i];
    const nextCusp = cusps[(i + 1) % 12];

    if (isInHouse(lon, cusp, nextCusp)) {
      return i + 1;
    }
  }

  // Fallback (e.g. if floating point rounding at boundary)
  return 1;
}

/**
 * Assigns an array of planets to their cuspal houses in KP,
 * and derives their KP lords (sign, star, sub, sub-sub lord).
 *
 * Pass `options` (TODO(#29 Q10): the near-boundary threshold has no default) to also get the sub
 * and sub-sub boundary fields on every planet. Without it the output is unchanged.
 */
export function assignPlanetsToHouses(
  planets: PlanetInput[],
  cusps: number[]
): PlanetHouseAssignment[];
export function assignPlanetsToHouses(
  planets: PlanetInput[],
  cusps: number[],
  options: PositionLordsOptions
): Array<PlanetHouseAssignment & SubBoundaryInfo & SubSubBoundaryInfo>;
export function assignPlanetsToHouses(
  planets: PlanetInput[],
  cusps: number[],
  options?: PositionLordsOptions
): PlanetHouseAssignment[] {
  return planets.map((p) => {
    const lon = normalizeDegrees(p.longitude);
    const house = getHouseForLongitude(lon, cusps);
    const cuspIndex = house - 1;
    const currentCusp = cusps[cuspIndex];
    const nextCusp = cusps[(cuspIndex + 1) % 12];

    const distancePassedCusp = normalizeDegrees(lon - currentCusp);
    const distanceToNextCusp = normalizeDegrees(nextCusp - lon);

    const lords = options ? getPositionLords(lon, options) : getPositionLords(lon);

    return {
      ...lords,
      name: p.name,
      house,
      distancePassedCusp,
      distanceToNextCusp,
      isRetrograde: p.speed !== undefined ? p.speed < 0 : undefined,
    };
  });
}
