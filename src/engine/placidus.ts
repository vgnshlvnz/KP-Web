import {
  normalizeDegrees,
  sind,
  cosd,
  tand,
  asind,
  atand,
} from './astronomy.js';

const VERY_SMALL = 1.0e-10;
const VERY_SMALL_PLAC_ITER = 1.0 / 360000.0; // 0.01 arcseconds convergence threshold
const MAX_ITERATIONS = 100;

/**
 * Oblique triangle intersection between great circle of pole height f and ecliptic.
 * Directly based on Swiss Ephemeris asc2 implementation (Meeus/Placidus).
 */
export function asc2(x: number, f: number, sine: number, cose: number): number {
  let ass = -tand(f) * sine + cose * cosd(x);
  if (Math.abs(ass) < VERY_SMALL) {
    ass = 0.0;
  }

  let sinx = sind(x);
  if (Math.abs(sinx) < VERY_SMALL) {
    sinx = 0.0;
  }

  if (sinx === 0.0) {
    ass = ass < 0.0 ? -VERY_SMALL : VERY_SMALL;
  } else if (ass === 0.0) {
    ass = sinx < 0.0 ? -90.0 : 90.0;
  } else {
    ass = atand(sinx / ass);
  }

  if (ass < 0.0) {
    ass += 180.0;
  }

  return ass;
}

/**
 * Calculates the crossing of the ecliptic with great circle of pole height f.
 * Handles quadrants 1..4 correctly.
 * Based on Swiss Ephemeris Asc1.
 */
export function asc1(x1: number, f: number, sine: number, cose: number): number {
  const x = normalizeDegrees(x1);
  const n = Math.floor(x / 90.0) + 1; // quadrant 1..4

  if (Math.abs(90.0 - f) < VERY_SMALL) {
    return 180.0;
  }
  if (Math.abs(90.0 + f) < VERY_SMALL) {
    return 0.0;
  }

  let ass: number;
  if (n === 1) {
    ass = asc2(x, f, sine, cose);
  } else if (n === 2) {
    ass = 180.0 - asc2(180.0 - x, -f, sine, cose);
  } else if (n === 3) {
    ass = 180.0 + asc2(x - 180.0, -f, sine, cose);
  } else {
    ass = 360.0 - asc2(360.0 - x, f, sine, cose);
  }

  ass = normalizeDegrees(ass);

  if (Math.abs(ass - 90.0) < VERY_SMALL) ass = 90.0;
  if (Math.abs(ass - 180.0) < VERY_SMALL) ass = 180.0;
  if (Math.abs(ass - 270.0) < VERY_SMALL) ass = 270.0;
  if (Math.abs(ass - 360.0) < VERY_SMALL) ass = 0.0;

  return ass;
}

/**
 * Normalized degree difference in range [-180, +180].
 */
export function difdeg2n(p1: number, p2: number): number {
  return ((p1 - p2 + 540.0) % 360.0) - 180.0;
}

/**
 * Computes Midheaven (MC) from ARMC and obliquity.
 */
export function armcToMC(armc: number, obliquity: number): number {
  const th = normalizeDegrees(armc);
  const cose = cosd(obliquity);

  let mc: number;
  if (Math.abs(th - 90.0) > VERY_SMALL && Math.abs(th - 270.0) > VERY_SMALL) {
    const tant = tand(th);
    mc = atand(tant / cose);
    if (th > 90.0 && th <= 270.0) {
      mc = normalizeDegrees(mc + 180.0);
    }
  } else {
    mc = Math.abs(th - 90.0) <= VERY_SMALL ? 90.0 : 270.0;
  }

  return normalizeDegrees(mc);
}

/**
 * Inverts Midheaven (MC) to ARMC.
 * Used for Horary (Prashna) where Ascendant/MC is fixed and sidereal time is derived.
 */
export function mcToArmc(mc: number, obliquity: number): number {
  const mcNorm = normalizeDegrees(mc);
  if (Math.abs(mcNorm - 90.0) <= VERY_SMALL) return 90.0;
  if (Math.abs(mcNorm - 270.0) <= VERY_SMALL) return 270.0;

  const tanMC = tand(mcNorm);
  let armc = atand(tanMC * cosd(obliquity));
  if (mcNorm > 90.0 && mcNorm <= 270.0) {
    armc = normalizeDegrees(armc + 180.0);
  }
  return normalizeDegrees(armc);
}

export interface PlacidusCuspsResult {
  tropicalCusps: number[]; // 12 cusps in degrees [0..11] representing houses 1..12
  siderealCusps: number[]; // 12 cusps in degrees [0..11] representing houses 1..12
  ascendantTropical: number;
  midheavenTropical: number;
  ascendantSidereal: number;
  midheavenSidereal: number;
  isPolarFallback: boolean;
  warnings?: string[];
}

/**
 * Computes all 12 Placidus house cusps for the given ARMC (sidereal time in degrees),
 * geographic latitude, obliquity, and sidereal ayanamsa.
 *
 * Matches Swiss Ephemeris swe_houses / swe_houses_ex to arc-second precision.
 */
export function calculatePlacidusCusps(
  armc: number,
  latitude: number,
  obliquity: number,
  ayanamsa: number = 0.0
): PlacidusCuspsResult {
  const th = normalizeDegrees(armc);
  let fi = latitude;
  const ekl = obliquity;
  const warnings: string[] = [];

  // Protect north and south poles
  if (Math.abs(Math.abs(fi) - 90.0) < VERY_SMALL) {
    fi = fi < 0 ? -90.0 + VERY_SMALL : 90.0 - VERY_SMALL;
  }

  const sine = sind(ekl);
  const cose = cosd(ekl);
  const tane = tand(ekl);
  const tanfi = tand(fi);

  // Compute MC and Ascendant
  const mcTrop = armcToMC(th, ekl);
  const ascTrop = asc1(th + 90.0, fi, sine, cose);

  // Polar circle check: Placidus fails inside the polar circles (|lat| >= 90 - eps)
  let isPolarFallback = false;
  if (Math.abs(fi) >= 90.0 - ekl) {
    warnings.push(
      `Latitude ${fi.toFixed(2)}° is within polar circle. Switched to Porphyry house division.`
    );
    isPolarFallback = true;
    return calculatePorphyryCusps(ascTrop, mcTrop, ayanamsa, warnings);
  }

  const a = asind(tanfi * tane);
  const fh1 = atand(sind(a / 3.0) / tane);
  const fh2 = atand(sind((a * 2.0) / 3.0) / tane);

  // Array for 12 tropical cusps: index 0 = House 1, index 11 = House 12
  const tropCusps = new Array<number>(12);
  tropCusps[0] = ascTrop; // House 1 (Ascendant)
  tropCusps[9] = mcTrop;  // House 10 (Midheaven)

  // Intermediate houses to compute
  const intermediateHouses = [
    { houseIndex: 10, rectasc: 30.0, fh: fh1, divisor: 3.0 },  // House 11
    { houseIndex: 11, rectasc: 60.0, fh: fh2, divisor: 1.5 },  // House 12
    { houseIndex: 1,  rectasc: 120.0, fh: fh2, divisor: 1.5 }, // House 2
    { houseIndex: 2,  rectasc: 150.0, fh: fh1, divisor: 3.0 }, // House 3
  ];

  for (const { houseIndex, rectasc, fh, divisor } of intermediateHouses) {
    const ra = normalizeDegrees(rectasc + th);
    let tant = tand(asind(sine * sind(asc1(ra, fh, sine, cose))));

    if (Math.abs(tant) < VERY_SMALL) {
      tropCusps[houseIndex] = ra;
    } else {
      let f = atand(sind(asind(tanfi * tant) / divisor) / tant);
      tropCusps[houseIndex] = asc1(ra, f, sine, cose);

      let cuspsv = 0.0;
      let converged = false;

      for (let i = 1; i <= MAX_ITERATIONS; i++) {
        tant = tand(asind(sine * sind(tropCusps[houseIndex])));
        if (Math.abs(tant) < VERY_SMALL) {
          tropCusps[houseIndex] = ra;
          converged = true;
          break;
        }

        f = atand(sind(asind(tanfi * tant) / divisor) / tant);
        tropCusps[houseIndex] = asc1(ra, f, sine, cose);

        if (i > 1 && Math.abs(difdeg2n(tropCusps[houseIndex], cuspsv)) < VERY_SMALL_PLAC_ITER) {
          converged = true;
          break;
        }
        cuspsv = tropCusps[houseIndex];
      }

      if (!converged) {
        warnings.push(
          `Placidus iteration for house ${houseIndex + 1} did not converge; using Porphyry fallback.`
        );
        isPolarFallback = true;
        return calculatePorphyryCusps(ascTrop, mcTrop, ayanamsa, warnings);
      }
    }
  }

  // Opposite houses (180 degrees apart)
  tropCusps[3] = normalizeDegrees(tropCusps[9] + 180.0);  // House 4 = MC + 180
  tropCusps[4] = normalizeDegrees(tropCusps[10] + 180.0); // House 5 = H11 + 180
  tropCusps[5] = normalizeDegrees(tropCusps[11] + 180.0); // House 6 = H12 + 180
  tropCusps[6] = normalizeDegrees(tropCusps[0] + 180.0);  // House 7 = Asc + 180 (Descendant)
  tropCusps[7] = normalizeDegrees(tropCusps[1] + 180.0);  // House 8 = H2 + 180
  tropCusps[8] = normalizeDegrees(tropCusps[2] + 180.0);  // House 9 = H3 + 180

  // Sidereal conversion by subtracting ayanamsa
  const sidCusps = tropCusps.map((c) => normalizeDegrees(c - ayanamsa));
  const ascSid = normalizeDegrees(ascTrop - ayanamsa);
  const mcSid = normalizeDegrees(mcTrop - ayanamsa);

  return {
    tropicalCusps: tropCusps,
    siderealCusps: sidCusps,
    ascendantTropical: ascTrop,
    midheavenTropical: mcTrop,
    ascendantSidereal: ascSid,
    midheavenSidereal: mcSid,
    isPolarFallback,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Porphyry house calculation fallback for circumpolar latitudes where Placidus cannot be computed.
 */
function calculatePorphyryCusps(
  asc: number,
  mc: number,
  ayanamsa: number,
  warnings: string[]
): PlacidusCuspsResult {
  const tropCusps = new Array<number>(12);
  tropCusps[0] = asc;
  tropCusps[9] = mc;

  // Quadrant 4 (from MC to Ascendant)
  let q4 = normalizeDegrees(asc - mc);
  let s4 = q4 / 3.0;
  tropCusps[10] = normalizeDegrees(mc + s4);
  tropCusps[11] = normalizeDegrees(mc + 2.0 * s4);

  // Quadrant 1 (from Ascendant to IC)
  const ic = normalizeDegrees(mc + 180.0);
  let q1 = normalizeDegrees(ic - asc);
  let s1 = q1 / 3.0;
  tropCusps[1] = normalizeDegrees(asc + s1);
  tropCusps[2] = normalizeDegrees(asc + 2.0 * s1);

  // Opposite cusps
  tropCusps[3] = ic;
  tropCusps[4] = normalizeDegrees(tropCusps[10] + 180.0);
  tropCusps[5] = normalizeDegrees(tropCusps[11] + 180.0);
  tropCusps[6] = normalizeDegrees(tropCusps[0] + 180.0);
  tropCusps[7] = normalizeDegrees(tropCusps[1] + 180.0);
  tropCusps[8] = normalizeDegrees(tropCusps[2] + 180.0);

  const sidCusps = tropCusps.map((c) => normalizeDegrees(c - ayanamsa));

  return {
    tropicalCusps: tropCusps,
    siderealCusps: sidCusps,
    ascendantTropical: asc,
    midheavenTropical: mc,
    ascendantSidereal: normalizeDegrees(asc - ayanamsa),
    midheavenSidereal: normalizeDegrees(mc - ayanamsa),
    isPolarFallback: true,
    warnings,
  };
}
