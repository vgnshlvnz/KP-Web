/**
 * Ephemeris vs Swiss Ephemeris, 5 cases x 2 ayanamsas (work package `port-ephemeris`, #41).
 *
 * Reference values: docs/build-fix/audit.md Appendix A.1 to A.5 (Swiss Ephemeris 2.10.03,
 * `pyswisseph`, `sepl_18`/`semo_18`, `FLG_SWIEPH | FLG_SIDEREAL`). Longitudes are sidereal degrees.
 * Swiss Ephemeris was used only to generate these numbers; it is not a dependency.
 *
 * Tolerances (arcseconds): Sun 2, Moon 6, Mercury..Saturn 12 (measured maximum plus margin; the owner
 * may tighten them), mean ayanamsa 0.01, mean node 1. Mean node only (#29 (owner, 2026-11-21)); the
 * true-node rows of Appendix A are no longer used.
 */
import { describe, it, expect } from 'vitest';
import { calculateEphemeris } from '../src/engine/ephemeris.js';
import type { AyanamsaMode } from '../src/engine/types.js';

type Reference = { kp_old: number; kp_new: number };

interface ReferenceCase {
  label: string;
  utc: string;
  jdUt: number;
  dPsiArcsec: number;
  ayanamsa: Record<AyanamsaMode, { mean: number; true: number }>;
  bodies: Record<string, Reference>;
}

const CASES: ReferenceCase[] = [
  {
    label: 'KL 1992',
    utc: '1992-03-10T22:14:00Z',
    jdUt: 2448692.426388889,
    dPsiArcsec: 17.4325,
    ayanamsa: {
      kp_old: { mean: 23.65114606, true: 23.65598842 },
      kp_new: { mean: 23.6712715, true: 23.67611386 },
    },
    bodies: {
      'Sun': { kp_old: 326.9440666, kp_new: 326.9239411 },
      'Moon': { kp_old: 42.0295069, kp_new: 42.0093815 },
      'Mars': { kp_old: 293.0611426, kp_new: 293.0410172 },
      'Mercury': { kp_old: 345.0414661, kp_new: 345.0213406 },
      'Jupiter': { kp_old: 134.6139223, kp_new: 134.5937968 },
      'Venus': { kp_old: 302.5516451, kp_new: 302.5315197 },
      'Saturn': { kp_old: 290.2731592, kp_new: 290.2530337 },
      'Rahu (mean)': { kp_old: 252.4479023, kp_new: 252.4277768 },
      'Ketu (mean)': { kp_old: 72.4479023, kp_new: 72.4277768 },
      'Rahu (true)': { kp_old: 252.9012358, kp_new: 252.8811104 },
      'Ketu (true)': { kp_old: 72.9012358, kp_new: 72.8811104 },
    },
  },
  {
    label: 'Greenwich 2000',
    utc: '2000-01-01T12:00:00Z',
    jdUt: 2451545.0,
    dPsiArcsec: -13.9315,
    ayanamsa: {
      kp_old: { mean: 23.76024004, true: 23.75637017 },
      kp_new: { mean: 23.78036498, true: 23.77649512 },
    },
    bodies: {
      'Sun': { kp_old: 256.6125485, kp_new: 256.5924236 },
      'Moon': { kp_old: 199.5673813, kp_new: 199.5472563 },
      'Mars': { kp_old: 304.2069324, kp_new: 304.1868074 },
      'Mercury': { kp_old: 248.1329069, kp_new: 248.1127819 },
      'Jupiter': { kp_old: 1.496717, kp_new: 1.4765921 },
      'Venus': { kp_old: 217.8094182, kp_new: 217.7892933 },
      'Saturn': { kp_old: 16.6392933, kp_new: 16.6191684 },
      'Rahu (mean)': { kp_old: 101.2842759, kp_new: 101.2641509 },
      'Ketu (mean)': { kp_old: 281.2842759, kp_new: 281.2641509 },
      'Rahu (true)': { kp_old: 100.1976527, kp_new: 100.1775277 },
      'Ketu (true)': { kp_old: 280.1976527, kp_new: 280.1775277 },
    },
  },
  {
    label: 'Chennai 1950',
    utc: '1950-06-15T18:29:30Z',
    jdUt: 2433448.270486111,
    dPsiArcsec: -1.2657,
    ayanamsa: {
      kp_old: { mean: 23.06821122, true: 23.06785963 },
      kp_new: { mean: 23.08833912, true: 23.08798753 },
    },
    bodies: {
      'Sun': { kp_old: 61.000356, kp_new: 60.9802281 },
      'Moon': { kp_old: 62.2216636, kp_new: 62.2015357 },
      'Mars': { kp_old: 158.4111041, kp_new: 158.3909762 },
      'Mercury': { kp_old: 38.369697, kp_new: 38.3495691 },
      'Jupiter': { kp_old: 314.1821124, kp_new: 314.1619845 },
      'Venus': { kp_old: 23.2874832, kp_new: 23.2673553 },
      'Saturn': { kp_old: 140.3495955, kp_new: 140.3294676 },
      'Rahu (mean)': { kp_old: 340.2668205, kp_new: 340.2466926 },
      'Ketu (mean)': { kp_old: 160.2668205, kp_new: 160.2466926 },
      'Rahu (true)': { kp_old: 340.7874864, kp_new: 340.7673585 },
      'Ketu (true)': { kp_old: 160.7874864, kp_new: 160.7673585 },
    },
  },
  {
    label: 'Petaling Jaya 2026',
    utc: '2026-11-21T01:00:00Z',
    jdUt: 2461365.541666667,
    dPsiArcsec: 8.1737,
    ayanamsa: {
      kp_old: { mean: 24.13584602, true: 24.1381165 },
      kp_new: { mean: 24.15596915, true: 24.15823963 },
    },
    bodies: {
      'Sun': { kp_old: 214.5836556, kp_new: 214.5635325 },
      'Moon': { kp_old: 346.5658552, kp_new: 346.545732 },
      'Mars': { kp_old: 123.8271669, kp_new: 123.8070438 },
      'Mercury': { kp_old: 195.0995922, kp_new: 195.0794691 },
      'Jupiter': { kp_old: 122.11225, kp_new: 122.0921268 },
      'Venus': { kp_old: 179.6770784, kp_new: 179.6569553 },
      'Saturn': { kp_old: 344.1487878, kp_new: 344.1286646 },
      'Rahu (mean)': { kp_old: 300.8741479, kp_new: 300.8540247 },
      'Ketu (mean)': { kp_old: 120.8741479, kp_new: 120.8540247 },
      'Rahu (true)': { kp_old: 300.8698384, kp_new: 300.8497152 },
      'Ketu (true)': { kp_old: 120.8698384, kp_new: 120.8497152 },
    },
  },
  {
    label: 'Tromso 2010',
    utc: '2010-12-21T03:00:00Z',
    jdUt: 2455551.625,
    dPsiArcsec: 17.0466,
    ayanamsa: {
      kp_old: { mean: 23.91347595, true: 23.91821112 },
      kp_new: { mean: 23.93360017, true: 23.93833535 },
    },
    bodies: {
      'Sun': { kp_old: 245.2063128, kp_new: 245.1861886 },
      'Moon': { kp_old: 62.4477699, kp_new: 62.4276456 },
      'Mars': { kp_old: 256.0793162, kp_new: 256.059192 },
      'Mercury': { kp_old: 242.6503949, kp_new: 242.6302706 },
      'Jupiter': { kp_old: 331.3314708, kp_new: 331.3113466 },
      'Venus': { kp_old: 199.8073222, kp_new: 199.787198 },
      'Saturn': { kp_old: 172.1654533, kp_new: 172.1453291 },
      'Rahu (mean)': { kp_old: 248.9651793, kp_new: 248.9450551 },
      'Ketu (mean)': { kp_old: 68.9651793, kp_new: 68.9450551 },
      'Rahu (true)': { kp_old: 248.8178986, kp_new: 248.7977744 },
      'Ketu (true)': { kp_old: 68.8178986, kp_new: 68.7977744 },
    },
  },
];

const MODES: AyanamsaMode[] = ['kp_old', 'kp_new'];

/** Smallest signed angular difference a - b in arcseconds. */
function diffArcsec(a: number, b: number): number {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d * 3600;
}

const TOLERANCE_ARCSEC: Record<string, number> = {
  Sun: 2,
  Moon: 6,
  Mars: 12,
  Mercury: 12,
  Jupiter: 12,
  Venus: 12,
  Saturn: 12,
};
const MEAN_AYANAMSA_ARCSEC = 0.01;
const MEAN_NODE_ARCSEC = 1;

function run(c: ReferenceCase, ayanamsa: AyanamsaMode) {
  return calculateEphemeris(new Date(c.utc), { ayanamsa });
}

describe.each(CASES)('ephemeris vs Swiss Ephemeris: $label', (c) => {
  it('reference JD matches the instant (fixture sanity)', () => {
    expect(run(c, 'kp_old').julianDayUt).toBeCloseTo(c.jdUt, 8);
  });

  describe.each(MODES)('%s', (mode) => {
    it(`mean ayanamsa within ${MEAN_AYANAMSA_ARCSEC}"`, () => {
      const r = run(c, mode);
      expect(Math.abs(r.meanAyanamsaDeg - c.ayanamsa[mode].mean) * 3600).toBeLessThanOrEqual(
        MEAN_AYANAMSA_ARCSEC
      );
    });

    it('true ayanamsa = mean + nutation in longitude, and nutation agrees with Swiss Ephemeris to 0.2"', () => {
      const r = run(c, mode);
      expect(r.trueAyanamsaDeg - r.meanAyanamsaDeg).toBeCloseTo(r.nutationInLongitudeDeg, 12);
      // astronomy-engine's IAU 2000B nutation vs the dPsi in Appendix A: same model family, <0.14".
      expect(Math.abs(r.nutationInLongitudeDeg * 3600 - c.dPsiArcsec)).toBeLessThan(0.2);
      expect(Math.abs(r.trueAyanamsaDeg - c.ayanamsa[mode].true) * 3600).toBeLessThan(0.2);
    });

    for (const [name, tol] of Object.entries(TOLERANCE_ARCSEC)) {
      it(`${name} within ${tol}"`, () => {
        const p = run(c, mode).planets.find((x) => x.name === name)!;
        expect(Math.abs(diffArcsec(p.siderealLongitude, c.bodies[name][mode]))).toBeLessThanOrEqual(tol);
      });
    }

    for (const name of ['Rahu', 'Ketu'] as const) {
      it(`${name} (mean node) within ${MEAN_NODE_ARCSEC}"`, () => {
        const p = run(c, mode).planets.find((x) => x.name === name)!;
        expect(
          Math.abs(diffArcsec(p.siderealLongitude, c.bodies[`${name} (mean)`][mode]))
        ).toBeLessThanOrEqual(MEAN_NODE_ARCSEC);
      });
    }
  });
});

describe('regressions', () => {
  const kl = CASES[0];

  it('#33: sidereal Sun, KL 1992, KP Old = 326.94407 deg +/- 2" (was 326.94887, off by dPsi)', () => {
    const sun = run(kl, 'kp_old').planets.find((p) => p.name === 'Sun')!;
    expect(Math.abs(diffArcsec(sun.siderealLongitude, 326.94407))).toBeLessThanOrEqual(2);
    // The old value omitted dPsi (+17.43"); make sure we are nowhere near it.
    expect(Math.abs(diffArcsec(sun.siderealLongitude, 326.94887))).toBeGreaterThan(10);
  });

  it('#33: sidereal = tropical - (mean ayanamsa + dPsi) for every body, not tropical - mean ayanamsa', () => {
    for (const c of CASES) {
      for (const mode of MODES) {
        const r = run(c, mode);
        for (const p of r.planets) {
          expect(diffArcsec(p.tropicalLongitude - (r.meanAyanamsaDeg + r.nutationInLongitudeDeg), p.siderealLongitude)).toBeCloseTo(0, 6);
        }
      }
    }
  });
});
