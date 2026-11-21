/**
 * KP Four-Level Significators Module.
 *
 * Implements Krishnamurti Paddhati Four-Level Significators (House-wise and Planet-wise),
 * ordered from strongest to weakest:
 *   Level 1: Planets in the star of a house's occupants (strongest)
 *   Level 2: The occupants of the house
 *   Level 3: Planets in the star of the house cusp's sign lord
 *   Level 4: The house cusp's sign lord (weakest)
 *
 * Includes standard KP agent rules for Rahu and Ketu:
 *   Rahu/Ketu acts as an agent representing:
 *   1. Planet(s) conjunct with it (same sign)
 *   2. Planet(s) aspecting it
 *   3. Sign lord of the sign occupied by it
 *   4. Star lord of the star occupied by it
 */

import {
  FourLevelSignificators,
  HouseCusp,
  PlanetName,
  PlanetaryPosition,
} from '../types.js';

export const DOCUMENTED_RAHU_KETU_RULES =
  'Standard KP School (K.S. Krishnamurti): Rahu and Ketu act as proxy agents for: (1) planets conjunct with them in the same sign, (2) planets casting aspects, (3) the sign lord of their occupied sign, and (4) the star lord of their occupied nakshatra. They inherit and transmit the significations of these planets.';

/**
 * Calculates four-level significators for all 12 houses and all planets.
 */
export function calculateSignificators(
  planets: PlanetaryPosition[],
  houses: HouseCusp[]
): FourLevelSignificators {
  const primaryBodies: PlanetName[] = [
    'Sun',
    'Moon',
    'Mars',
    'Mercury',
    'Jupiter',
    'Venus',
    'Saturn',
    'Rahu',
    'Ketu',
  ];

  // Helper map from planet name to position
  const planetMap = new Map<PlanetName, PlanetaryPosition>();
  for (const p of planets) {
    planetMap.set(p.name, p);
  }

  // 1. Identify occupants of each house (Level 2)
  const houseOccupants: Record<number, PlanetName[]> = {};
  for (let h = 1; h <= 12; h++) {
    houseOccupants[h] = [];
  }
  for (const body of primaryBodies) {
    const p = planetMap.get(body);
    if (p && p.house >= 1 && p.house <= 12) {
      houseOccupants[p.house].push(body);
    }
  }

  // 2. Identify Cusp Sign Lord for each house (Level 4)
  const houseCuspLord: Record<number, PlanetName> = {};
  for (const h of houses) {
    houseCuspLord[h.houseNumber] = h.signLord as PlanetName;
  }

  // 3. Rahu & Ketu Agent Identification
  const agentsFor: Record<PlanetName, PlanetName[]> = {
    Sun: [],
    Moon: [],
    Mars: [],
    Mercury: [],
    Jupiter: [],
    Venus: [],
    Saturn: [],
    Rahu: [],
    Ketu: [],
    Uranus: [],
    Neptune: [],
    Pluto: [],
  };

  for (const node of ['Rahu', 'Ketu'] as PlanetName[]) {
    const nodePos = planetMap.get(node);
    if (!nodePos) continue;

    const represented = new Set<PlanetName>();

    // (a) Sign lord of occupied sign
    represented.add(nodePos.signLord as PlanetName);

    // (b) Star lord of occupied star
    represented.add(nodePos.starLord as PlanetName);

    // (c) Conjunction: planets in the same sign
    for (const other of primaryBodies) {
      if (other === node) continue;
      const otherPos = planetMap.get(other);
      if (otherPos && otherPos.signIndex === nodePos.signIndex) {
        represented.add(other);
      }
    }

    agentsFor[node] = Array.from(represented);
  }

  // 4. Build House-wise Significators
  const houseWise: FourLevelSignificators['houseWise'] = {};

  for (let h = 1; h <= 12; h++) {
    const occupants = houseOccupants[h] || [];
    const cuspLord = houseCuspLord[h];

    // Level 2: Occupants
    const level2 = [...occupants];

    // Level 1: Planets in star of occupants
    const level1: PlanetName[] = [];
    for (const occupant of occupants) {
      for (const candidate of primaryBodies) {
        const candPos = planetMap.get(candidate);
        if (candPos && candPos.starLord === occupant) {
          if (!level1.includes(candidate)) {
            level1.push(candidate);
          }
        }
      }
    }

    // Level 4: House Lord
    const level4 = cuspLord ? [cuspLord] : [];

    // Level 3: Planets in star of house lord
    const level3: PlanetName[] = [];
    if (cuspLord) {
      for (const candidate of primaryBodies) {
        const candPos = planetMap.get(candidate);
        if (candPos && candPos.starLord === cuspLord) {
          if (!level3.includes(candidate)) {
            level3.push(candidate);
          }
        }
      }
    }

    houseWise[h] = {
      level1,
      level2,
      level3,
      level4,
    };
  }

  // 5. Build Planet-wise Significators
  const planetWise: FourLevelSignificators['planetWise'] = {} as FourLevelSignificators['planetWise'];

  for (const p of primaryBodies) {
    const level1Houses: number[] = [];
    const level2Houses: number[] = [];
    const level3Houses: number[] = [];
    const level4Houses: number[] = [];

    for (let h = 1; h <= 12; h++) {
      if (houseWise[h].level1.includes(p)) level1Houses.push(h);
      if (houseWise[h].level2.includes(p)) level2Houses.push(h);
      if (houseWise[h].level3.includes(p)) level3Houses.push(h);
      if (houseWise[h].level4.includes(p)) level4Houses.push(h);
    }

    planetWise[p] = {
      level1Houses,
      level2Houses,
      level3Houses,
      level4Houses,
      agentsFor: agentsFor[p] || [],
    };
  }

  return {
    houseWise,
    planetWise,
    rahuKetuRules: DOCUMENTED_RAHU_KETU_RULES,
  };
}
