/**
 * Nutation for the unified engine: IAU 2000B, the model Swiss Ephemeris uses by default (#57).
 *
 * Why this file exists. `astronomy-engine`'s `e_tilt` is labelled "IAU 2000B" but evaluates only
 * the 5 largest terms of the 77-term series (plus the fixed planetary offsets). That truncation
 * leaves it up to about 0.26 arcsec away from Swiss Ephemeris in dPsi (0.13 arcsec at the audit
 * instants). A horary lagna that is placed on a sub edge then falls inside the previous sub in
 * Swiss Ephemeris terms (audit.md Appendix A, work package #56). This module evaluates the full
 * 77-term series. Every use of nutation in the engine (the true ayanamsa, true obliquity,
 * equation of the equinoxes and GAST, the mean node, the tropical planet longitudes) takes its
 * dPsi / dEps from `nutationIau2000b`, through `calculateNutation` in `astronomy.ts`.
 *
 * The model, as Swiss Ephemeris 2.10.03 evaluates it (`SEMOD_NUT_DEFAULT` = `SEMOD_NUT_IAU_2000B`
 * in `swephexp.h`, `calc_nutation_iau2000ab` in `swephlib.c`):
 *  - the 77 luni-solar terms of McCarthy & Luzum (2003), "An abridged model of the precession-
 *    nutation of the celestial pole", Cel. Mech. Dyn. Astron. 85, 37-49; IERS Conventions (2003),
 *    chapter 5 (the MHB_2000_SHORT series);
 *  - the Delaunay arguments l, l', F, D, Omega as the full Simon et al. (1994) / IERS Conventions
 *    (2003) eq. 5.43 polynomials in T (Julian centuries of TT from J2000.0), degree 4;
 *  - NO fixed planetary offset. SOFA / ERFA `nut00b` adds the constant offsets dPsi = -0.135 mas and
 *    dEps = +0.388 mas "in lieu of planetary terms"; Swiss Ephemeris does not. Following Swiss
 *    Ephemeris keeps the two within 1e-5 arcsec of each other, and the offsets are 1.4e-4 / 3.9e-4
 *    arcsec, i.e. below the 0.001 arcsec target of #57.
 *
 * The coefficient table is the IAU 2000B table as published in IERS Conventions (2003) and as
 * implemented in SOFA `iauNut00b` (IAU SOFA, http://www.iausofa.org). It was transcribed from ERFA
 * 2.0.1 `nut00b.c` (BSD-3-Clause, derived from SOFA, (C) NumFOCUS Foundation), not from Swiss
 * Ephemeris source code, which is AGPL / commercially licensed. Swiss Ephemeris was used only as
 * a numerical reference (`test/nutation-reference.test.ts`).
 *
 * Valid for 1900 to 2100 to better than 1 mas (the model's own accuracy); it keeps working outside
 * that range with growing error. Pure TypeScript, no dependencies; runs in Cloudflare Workers.
 */

/** Julian Day of the J2000.0 epoch (TT). */
const JD_J2000 = 2451545.0;

/** Arcseconds in a full turn. */
const ARCSEC_PER_TURN = 1296000.0;

const ARCSEC_TO_RAD = Math.PI / (180.0 * 3600.0);

/** Table units: 0.1 microarcsecond. */
const TABLE_UNIT_ARCSEC = 1e-7;

/**
 * One row per term: [l, l', F, D, Omega multipliers, then the longitude sin, T*sin and cos
 * coefficients and the obliquity cos, T*cos and sin coefficients], in units of 0.1 microarcsecond
 * (and per Julian century for the T columns). Order as in SOFA `nut00b`.
 *
 * dPsi = sum( (ps + pst*T) sin(arg) + pc cos(arg) )
 * dEps = sum( (ec + ect*T) cos(arg) + es sin(arg) )
 */
const IAU2000B_TERMS: readonly (readonly number[])[] = [
  [0, 0, 0, 0, 1, -172064161, -174666, 33386, 92052331, 9086, 15377],
  [0, 0, 2, -2, 2, -13170906, -1675, -13696, 5730336, -3015, -4587],
  [0, 0, 2, 0, 2, -2276413, -234, 2796, 978459, -485, 1374],
  [0, 0, 0, 0, 2, 2074554, 207, -698, -897492, 470, -291],
  [0, 1, 0, 0, 0, 1475877, -3633, 11817, 73871, -184, -1924],
  [0, 1, 2, -2, 2, -516821, 1226, -524, 224386, -677, -174],
  [1, 0, 0, 0, 0, 711159, 73, -872, -6750, 0, 358],
  [0, 0, 2, 0, 1, -387298, -367, 380, 200728, 18, 318],
  [1, 0, 2, 0, 2, -301461, -36, 816, 129025, -63, 367],
  [0, -1, 2, -2, 2, 215829, -494, 111, -95929, 299, 132],
  [0, 0, 2, -2, 1, 128227, 137, 181, -68982, -9, 39],
  [-1, 0, 2, 0, 2, 123457, 11, 19, -53311, 32, -4],
  [-1, 0, 0, 2, 0, 156994, 10, -168, -1235, 0, 82],
  [1, 0, 0, 0, 1, 63110, 63, 27, -33228, 0, -9],
  [-1, 0, 0, 0, 1, -57976, -63, -189, 31429, 0, -75],
  [-1, 0, 2, 2, 2, -59641, -11, 149, 25543, -11, 66],
  [1, 0, 2, 0, 1, -51613, -42, 129, 26366, 0, 78],
  [-2, 0, 2, 0, 1, 45893, 50, 31, -24236, -10, 20],
  [0, 0, 0, 2, 0, 63384, 11, -150, -1220, 0, 29],
  [0, 0, 2, 2, 2, -38571, -1, 158, 16452, -11, 68],
  [0, -2, 2, -2, 2, 32481, 0, 0, -13870, 0, 0],
  [-2, 0, 0, 2, 0, -47722, 0, -18, 477, 0, -25],
  [2, 0, 2, 0, 2, -31046, -1, 131, 13238, -11, 59],
  [1, 0, 2, -2, 2, 28593, 0, -1, -12338, 10, -3],
  [-1, 0, 2, 0, 1, 20441, 21, 10, -10758, 0, -3],
  [2, 0, 0, 0, 0, 29243, 0, -74, -609, 0, 13],
  [0, 0, 2, 0, 0, 25887, 0, -66, -550, 0, 11],
  [0, 1, 0, 0, 1, -14053, -25, 79, 8551, -2, -45],
  [-1, 0, 0, 2, 1, 15164, 10, 11, -8001, 0, -1],
  [0, 2, 2, -2, 2, -15794, 72, -16, 6850, -42, -5],
  [0, 0, -2, 2, 0, 21783, 0, 13, -167, 0, 13],
  [1, 0, 0, -2, 1, -12873, -10, -37, 6953, 0, -14],
  [0, -1, 0, 0, 1, -12654, 11, 63, 6415, 0, 26],
  [-1, 0, 2, 2, 1, -10204, 0, 25, 5222, 0, 15],
  [0, 2, 0, 0, 0, 16707, -85, -10, 168, -1, 10],
  [1, 0, 2, 2, 2, -7691, 0, 44, 3268, 0, 19],
  [-2, 0, 2, 0, 0, -11024, 0, -14, 104, 0, 2],
  [0, 1, 2, 0, 2, 7566, -21, -11, -3250, 0, -5],
  [0, 0, 2, 2, 1, -6637, -11, 25, 3353, 0, 14],
  [0, -1, 2, 0, 2, -7141, 21, 8, 3070, 0, 4],
  [0, 0, 0, 2, 1, -6302, -11, 2, 3272, 0, 4],
  [1, 0, 2, -2, 1, 5800, 10, 2, -3045, 0, -1],
  [2, 0, 2, -2, 2, 6443, 0, -7, -2768, 0, -4],
  [-2, 0, 0, 2, 1, -5774, -11, -15, 3041, 0, -5],
  [2, 0, 2, 0, 1, -5350, 0, 21, 2695, 0, 12],
  [0, -1, 2, -2, 1, -4752, -11, -3, 2719, 0, -3],
  [0, 0, 0, -2, 1, -4940, -11, -21, 2720, 0, -9],
  [-1, -1, 0, 2, 0, 7350, 0, -8, -51, 0, 4],
  [2, 0, 0, -2, 1, 4065, 0, 6, -2206, 0, 1],
  [1, 0, 0, 2, 0, 6579, 0, -24, -199, 0, 2],
  [0, 1, 2, -2, 1, 3579, 0, 5, -1900, 0, 1],
  [1, -1, 0, 0, 0, 4725, 0, -6, -41, 0, 3],
  [-2, 0, 2, 0, 2, -3075, 0, -2, 1313, 0, -1],
  [3, 0, 2, 0, 2, -2904, 0, 15, 1233, 0, 7],
  [0, -1, 0, 2, 0, 4348, 0, -10, -81, 0, 2],
  [1, -1, 2, 0, 2, -2878, 0, 8, 1232, 0, 4],
  [0, 0, 0, 1, 0, -4230, 0, 5, -20, 0, -2],
  [-1, -1, 2, 2, 2, -2819, 0, 7, 1207, 0, 3],
  [-1, 0, 2, 0, 0, -4056, 0, 5, 40, 0, -2],
  [0, -1, 2, 2, 2, -2647, 0, 11, 1129, 0, 5],
  [-2, 0, 0, 0, 1, -2294, 0, -10, 1266, 0, -4],
  [1, 1, 2, 0, 2, 2481, 0, -7, -1062, 0, -3],
  [2, 0, 0, 0, 1, 2179, 0, -2, -1129, 0, -2],
  [-1, 1, 0, 1, 0, 3276, 0, 1, -9, 0, 0],
  [1, 1, 0, 0, 0, -3389, 0, 5, 35, 0, -2],
  [1, 0, 2, 0, 0, 3339, 0, -13, -107, 0, 1],
  [-1, 0, 2, -2, 1, -1987, 0, -6, 1073, 0, -2],
  [1, 0, 0, 0, 2, -1981, 0, 0, 854, 0, 0],
  [-1, 0, 0, 1, 0, 4026, 0, -353, -553, 0, -139],
  [0, 0, 2, 1, 2, 1660, 0, -5, -710, 0, -2],
  [-1, 0, 2, 4, 2, -1521, 0, 9, 647, 0, 4],
  [-1, 1, 0, 1, 1, 1314, 0, 0, -700, 0, 0],
  [0, -2, 2, -2, 1, -1283, 0, 0, 672, 0, 0],
  [1, 0, 2, 2, 1, -1331, 0, 8, 663, 0, 4],
  [-2, 0, 2, 2, 2, 1383, 0, -2, -594, 0, -2],
  [-1, 0, 0, 0, 2, 1405, 0, 4, -610, 0, 2],
  [1, 1, 2, -2, 2, 1290, 0, 0, -556, 0, 0],
];

/** Number of luni-solar terms evaluated: the full IAU 2000B series (astronomy-engine uses 5). */
export const IAU2000B_TERM_COUNT = IAU2000B_TERMS.length;

export interface NutationArcsec {
  /** Nutation in longitude, arcseconds. */
  dPsiArcsec: number;
  /** Nutation in obliquity, arcseconds. */
  dEpsArcsec: number;
}

/** Reduces an angle in arcseconds to a radian value in [0, 2 pi). */
function arcsecToRadians(arcsec: number): number {
  const wrapped = arcsec % ARCSEC_PER_TURN;
  return (wrapped < 0 ? wrapped + ARCSEC_PER_TURN : wrapped) * ARCSEC_TO_RAD;
}

/**
 * IAU 2000B nutation in longitude and obliquity (full 77-term series, no planetary offset).
 *
 * @param jdTt Julian Day in Terrestrial Time (TT). Passing UT instead changes dPsi by under
 *   1e-5 arcsec per second of delta-T, so a UT / TT mix-up of a minute stays below 1 mas.
 */
export function nutationIau2000b(jdTt: number): NutationArcsec {
  if (!Number.isFinite(jdTt)) {
    throw new RangeError(`nutationIau2000b: Julian Day must be a finite number, got ${jdTt}`);
  }
  const t = (jdTt - JD_J2000) / 36525.0;

  // Fundamental (Delaunay) arguments, Simon et al. (1994); IERS Conventions (2003) eq. 5.43.
  const l = arcsecToRadians(
    485868.249036 + t * (1717915923.2178 + t * (31.8792 + t * (0.051635 - t * 0.0002447)))
  );
  const lp = arcsecToRadians(
    1287104.79305 + t * (129596581.0481 + t * (-0.5532 + t * (0.000136 - t * 0.00001149)))
  );
  const f = arcsecToRadians(
    335779.526232 + t * (1739527262.8478 + t * (-12.7512 + t * (-0.001037 + t * 0.00000417)))
  );
  const d = arcsecToRadians(
    1072260.70369 + t * (1602961601.209 + t * (-6.3706 + t * (0.006593 - t * 0.00003169)))
  );
  const om = arcsecToRadians(
    450160.398036 + t * (-6962890.5431 + t * (7.4722 + t * (0.007702 - t * 0.00005939)))
  );

  // Sum from the smallest term to the largest, which keeps the round-off down.
  let dPsi = 0.0;
  let dEps = 0.0;
  for (let i = IAU2000B_TERMS.length - 1; i >= 0; i--) {
    const k = IAU2000B_TERMS[i];
    const arg = k[0] * l + k[1] * lp + k[2] * f + k[3] * d + k[4] * om;
    const sinArg = Math.sin(arg);
    const cosArg = Math.cos(arg);
    dPsi += (k[5] + k[6] * t) * sinArg + k[7] * cosArg;
    dEps += (k[8] + k[9] * t) * cosArg + k[10] * sinArg;
  }
  return { dPsiArcsec: dPsi * TABLE_UNIT_ARCSEC, dEpsArcsec: dEps * TABLE_UNIT_ARCSEC };
}
