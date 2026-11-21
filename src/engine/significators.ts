import {
  KPCusp,
  PlanetHouseAssignment,
  HouseSignificator,
  PlanetSignificator,
  SignificatorsResult,
} from './types.js';

/**
 * Computes KP four-level significators (house-wise and planet-wise).
 *
 * Strength hierarchy (Level 1 is strongest, Level 4 is weakest):
 * 1. Planets in the star of a house's occupants.
 * 2. The occupants themselves (determined strictly by cusps!).
 * 3. Planets in the star of the cusp's sign lord.
 * 4. That cusp's sign lord.
 */
export function calculateSignificators(
  cusps: KPCusp[],
  planets: PlanetHouseAssignment[]
): SignificatorsResult {
  const houseWise: HouseSignificator[] = [];

  for (let h = 1; h <= 12; h++) {
    const cusp = cusps[h - 1];

    // Level 2: Occupants of the house (strictly from cuspal assignment)
    const occupants = planets
      .filter((p) => p.house === h)
      .map((p) => p.name);

    // Level 1: Planets in the star of a house's occupants
    const level1Planets = planets
      .filter((p) => occupants.includes(p.starLord))
      .map((p) => p.name);

    // Level 4: Cusp sign lord
    const cuspSignLord = cusp.signLord;
    const level4 = [cuspSignLord];

    // Level 3: Planets in the star of the cusp's sign lord
    const level3Planets = planets
      .filter((p) => p.starLord === cuspSignLord)
      .map((p) => p.name);

    const allSet = new Set<string>([
      ...level1Planets,
      ...occupants,
      ...level3Planets,
      ...level4,
    ]);

    houseWise.push({
      house: h,
      level1: Array.from(new Set(level1Planets)),
      level2: occupants,
      level3: Array.from(new Set(level3Planets)),
      level4,
      allSignificators: Array.from(allSet),
    });
  }

  // Planet-wise significators
  const planetNames = Array.from(new Set(planets.map((p) => p.name)));
  const planetWise: PlanetSignificator[] = planetNames.map((pName) => {
    const l1: number[] = [];
    const l2: number[] = [];
    const l3: number[] = [];
    const l4: number[] = [];

    for (const hw of houseWise) {
      if (hw.level1.includes(pName)) l1.push(hw.house);
      if (hw.level2.includes(pName)) l2.push(hw.house);
      if (hw.level3.includes(pName)) l3.push(hw.house);
      if (hw.level4.includes(pName)) l4.push(hw.house);
    }

    const all = Array.from(new Set([...l1, ...l2, ...l3, ...l4])).sort(
      (a, b) => a - b
    );

    return {
      planet: pName,
      signifiesHouses: {
        level1: l1,
        level2: l2,
        level3: l3,
        level4: l4,
        all,
      },
    };
  });

  return {
    houseWise,
    planetWise,
  };
}
