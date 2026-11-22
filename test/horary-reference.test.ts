/**
 * KP horary chart vs the Swiss Ephemeris reference values (work package `port-horary`, #56).
 *
 * Reference values: docs/build-fix/audit.md Appendix A.1 to A.4 (Swiss Ephemeris 2.10.03,
 * `pyswisseph`): the true ayanamsa and the true obliquity of each case. Swiss Ephemeris was used
 * only to generate those numbers; it is not a dependency. Appendix A.6 (`houses_armc`) pins the
 * Placidus cusps from an ARMC (`placidus.test.ts`); the horary chart reuses that same function, and
 * here the cusps from the returned ARMC are recomputed with it, plus an independent closed-form
 * Ascendant that shares no code with `asc1`.
 *
 * Horary rule under test: the lagna is the START of the chosen sub, in Swiss Ephemeris terms
 * (sidereal = tropical - TRUE ayanamsa), so it never falls in the previous sub (#33).
 *
 * Every option passed to `calculateHoraryChart` here is a TEST FIXTURE, not a default: each one is
 * an owner decision (#22 decided: no API default; #23, #24, #29 Q6..Q12) and the function has no
 * default for any.
 */
import { describe, it, expect } from 'vitest';
import { calculateHoraryChart } from '../src/engine/horary.js';
import { calculateChart } from '../src/engine/index.js';
import {
  calculatePlacidusCusps,
  PolarLatitudeError,
  isPolarLatitude,
} from '../src/engine/placidus.js';
import { getHoraryEntry, getHorary249Table, getPositionLords } from '../src/engine/kp-lords.js';
import { assignPlanetsToHouses } from '../src/engine/house-assignment.js';
import { normalizeDegrees, sind, cosd, tand, atan2d } from '../src/engine/astronomy.js';
import type {
  AyanamsaMode as AnyAyanamsaMode,
  ChartCalculationOptions,
  DateTimeLocation,
  HoraryCalculationResult,
} from '../src/engine/types.js';

// The SE fixtures below exist for the two KP modes only.
type AyanamsaMode = Extract<AnyAyanamsaMode, 'kp_old' | 'kp_new'>;

const OPTIONS = (ayanamsa: AyanamsaMode): ChartCalculationOptions => ({
  ayanamsa, // fixture, not a default (#22: no API default)
  nodeAgentRuleSet: 'sign_lord_star_lord_same_sign', // TODO(#23): fixture
  rulingPlanetSet: 'asc_star_sign_moon_star_sign_day_lord', // TODO(#24): fixture
});

/**
 * Swiss Ephemeris true obliquity and true ayanamsa per case, from Appendix A.1 to A.4.
 *
 * The numbers are the ones printed in Appendix A, with more digits (regenerated with pyswisseph
 * 2.10.03: `swe.calc_ut(jd, ECL_NUT)[0][0]` and `swe.get_ayanamsa_ex_ut(jd, FLG_SWIEPH)` for
 * `SIDM_KRISHNAMURTI` / `SIDM_KRISHNAMURTI_VP291`). Appendix A rounds the obliquity to 1e-7 deg
 * (0.00036") and the ayanamsa to 1e-8 deg, which is coarser than the 1e-4" the horary lagna is
 * aimed inside the sub, and the check below is [0, 0.5"] with no slack. Every value agrees with the
 * printed one to its last printed digit; none was changed.
 */
interface SeCase {
  input: DateTimeLocation;
  trueObliquity: number;
  trueAyanamsa: Record<AyanamsaMode, number>;
}
const KL: SeCase = {
  input: { year: 1992, month: 3, day: 11, hour: 6, minute: 14, second: 0, utcOffsetHours: 8, latitude: 3.139, longitude: 101.6869 },
  trueObliquity: 23.440720614551,
  trueAyanamsa: { kp_old: 23.655988417305, kp_new: 23.676113860623 },
};
const OTHER_CASES: Record<string, SeCase> = {
  gw2000: {
    input: { year: 2000, month: 1, day: 1, hour: 12, minute: 0, second: 0, utcOffsetHours: 0, latitude: 51.4779, longitude: -0.0015 },
    trueObliquity: 23.437676716055,
    trueAyanamsa: { kp_old: 23.756370172647, kp_new: 23.776495117237 },
  },
  chn1950: {
    input: { year: 1950, month: 6, day: 15, hour: 23, minute: 59, second: 30, utcOffsetHours: 5.5, latitude: 13.0827, longitude: 80.2707 },
    trueObliquity: 23.448070138257,
    trueAyanamsa: { kp_old: 23.067859626319, kp_new: 23.087987530635 },
  },
  pj2026: {
    input: { year: 2026, month: 11, day: 21, hour: 9, minute: 0, second: 0, utcOffsetHours: 8, latitude: 3.1073, longitude: 101.6067 },
    trueObliquity: 23.437825528014,
    trueAyanamsa: { kp_old: 24.138116497464, kp_new: 24.158239633113 },
  },
};

const NUMBERS = [1, 100, 145, 249];

/** Signed difference a - b wrapped into (-180, 180], in arcseconds. */
function diffArcsec(a: number, b: number): number {
  let d = a - b;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d * 3600;
}

/**
 * The sidereal Ascendant in Swiss Ephemeris terms: Placidus cusps recomputed from the returned
 * ARMC with SE's true obliquity, minus SE's true ayanamsa.
 */
function seSiderealAsc(c: SeCase, ayanamsa: AyanamsaMode, armc: number): number {
  return calculatePlacidusCusps(
    armc,
    c.input.latitude,
    c.trueObliquity,
    c.trueAyanamsa[ayanamsa]
  ).ascendantSidereal;
}

describe('horary lagna at the start of the sub, KL 1992 (Appendix A.1, KP Old)', () => {
  for (const n of NUMBERS) {
    describe(`horary number ${n}`, () => {
      const entry = getHoraryEntry(n);
      const chart = calculateHoraryChart(
        { questionTime: KL.input, horaryNumber: n },
        OPTIONS('kp_old')
      );

      it('SE-sidereal Asc minus the sub start is in [0, 0.5"], never negative', () => {
        const se = seSiderealAsc(KL, 'kp_old', chart.armc);
        const d = diffArcsec(se, entry.startLongitude);
        expect(d).toBeGreaterThanOrEqual(0);
        expect(d).toBeLessThanOrEqual(0.5);
      });

      it('the engine own sidereal Asc is inside the sub, within 0.001" of its start', () => {
        // Recompute the cusps from the returned ARMC with the chart own true ayanamsa and obliquity.
        const again = calculatePlacidusCusps(
          chart.armc,
          KL.input.latitude,
          chart.obliquityTrue,
          chart.ayanamsaValue
        );
        const d = diffArcsec(again.ascendantSidereal, entry.startLongitude);
        expect(d).toBeGreaterThanOrEqual(0);
        expect(d).toBeLessThanOrEqual(0.001);
        for (let i = 0; i < 12; i++) {
          expect(Math.abs(diffArcsec(again.siderealCusps[i], chart.cusps[i].longitude))).toBeLessThan(1e-9);
        }
        expect(chart.ascendant).toBe(chart.cusps[0].longitude);
      });

      it('the ARMC gives this Ascendant by an independent closed form', () => {
        // Asc = atan2(cos ARMC, -(sin ARMC cos eps + tan phi sin eps)); shares no code with asc1.
        const eps = chart.obliquityTrue;
        const tropical = normalizeDegrees(
          atan2d(
            cosd(chart.armc),
            -(sind(chart.armc) * cosd(eps) + tand(KL.input.latitude) * sind(eps))
          )
        );
        const target = normalizeDegrees(entry.startLongitude + chart.ayanamsaValue);
        const d = diffArcsec(tropical, target);
        expect(d).toBeGreaterThanOrEqual(0);
        expect(d).toBeLessThan(0.001);
      });

      it('the Asc sub lord (and sign, star, 1-249 number) equal the table row', () => {
        const asc = chart.cusps[0];
        expect(asc.signName).toBe(entry.signName);
        expect(asc.signLord).toBe(entry.signLord);
        expect(asc.starName).toBe(entry.starName);
        expect(asc.starLord).toBe(entry.starLord);
        expect(asc.subLord).toBe(entry.subLord);
        expect(asc.horary249Number).toBe(n);
        expect(getPositionLords(chart.ascendant).subLord).toBe(entry.subLord);
        // Ruling planets use the horary Ascendant.
        expect(chart.rulingPlanets.ascendantStarLord).toBe(entry.starLord);
        expect(chart.rulingPlanets.ascendantSignLord).toBe(entry.signLord);
      });

      it('reports the lagna target exactly, and the sub span', () => {
        expect(chart.lagnaTargetDeg).toBe(entry.startLongitude);
        expect(chart.horarySubStartDeg).toBe(entry.startLongitude);
        expect(chart.horarySubEndDeg).toBe(entry.endLongitude);
        expect(chart.horaryNumber).toBe(n);
        expect(chart.useSubMidpoint).toBe(false);
        expect(chart.invertedRamcDeg).toBe(chart.armc);
      });
    });
  }
});

describe('every one of the 249 numbers lands in its own sub', () => {
  const cases: Array<[string, SeCase, AyanamsaMode]> = [
    ['KL 1992 KP Old', KL, 'kp_old'],
    ['KL 1992 KP New', KL, 'kp_new'],
    ...Object.entries(OTHER_CASES).flatMap(([id, c]): Array<[string, SeCase, AyanamsaMode]> => [
      [`${id} KP Old`, c, 'kp_old'],
      [`${id} KP New`, c, 'kp_new'],
    ]),
  ];
  for (const [label, c, ayanamsa] of cases) {
    it(`${label}: Asc is in sub n (engine terms), and in [0, 0.2") from the start in SE terms`, () => {
      for (const entry of getHorary249Table()) {
        const chart = calculateHoraryChart(
          { questionTime: c.input, horaryNumber: entry.number },
          OPTIONS(ayanamsa)
        );
        // The engine is self-consistent: lagna in sub n, never in sub n - 1 (also for n = 1,
        // where a tiny negative error would wrap to 359.99999 deg, sub 249).
        expect(chart.cusps[0].horary249Number, `number ${entry.number}`).toBe(entry.number);
        expect(chart.cusps[0].subLord, `number ${entry.number}`).toBe(entry.subLord);
        expect(chart.cusps[0].starLord).toBe(entry.starLord);
        expect(chart.cusps[0].signLord).toBe(entry.signLord);
        const own = diffArcsec(chart.ascendant, entry.startLongitude);
        expect(own).toBeGreaterThanOrEqual(0);
        expect(own).toBeLessThan(0.001);

        // In Swiss Ephemeris terms the lagna is on the start of the sub and never in the previous
        // one: 0 <= offset < 0.2". The upper bound is the old `|offset| < 0.2"` bound, kept as it
        // was (not loosened); the lower bound is new. The engine and Swiss Ephemeris now use the
        // same nutation (the 77-term IAU 2000B series, #57); with astronomy-engine's 5-term
        // nutation this offset was up to 0.13" and negative at Greenwich 2000. What is left is the
        // 1e-4" aim inside the sub plus the ayanamsa polynomial's 1e-4" or so. KL 1992 additionally
        // has the [0, 0.5"] tests below.
        const se = diffArcsec(seSiderealAsc(c, ayanamsa, chart.armc), entry.startLongitude);
        expect(se, `number ${entry.number}`).toBeGreaterThanOrEqual(0);
        expect(se, `number ${entry.number}`).toBeLessThan(0.2);
      }
    });
  }

  it('KL 1992: in SE terms all 249 are in [0, 0.5"] (never in the previous sub)', () => {
    for (const ayanamsa of ['kp_old', 'kp_new'] as const) {
      for (const entry of getHorary249Table()) {
        const chart = calculateHoraryChart(
          { questionTime: KL.input, horaryNumber: entry.number },
          OPTIONS(ayanamsa)
        );
        const d = diffArcsec(seSiderealAsc(KL, ayanamsa, chart.armc), entry.startLongitude);
        expect(d, `${ayanamsa} number ${entry.number}`).toBeGreaterThanOrEqual(0);
        expect(d, `${ayanamsa} number ${entry.number}`).toBeLessThanOrEqual(0.5);
      }
    }
  });

  it('Greenwich 2000 (the case that was 0.08" to 0.13" inside the previous sub, #57): all 249 in [0, 0.2")', () => {
    // Kept as its own test so the regression for #57 is named. With astronomy-engine's nutation the
    // offset here was -0.133 to -0.082 arcsec for both ayanamsas.
    for (const ayanamsa of ['kp_old', 'kp_new'] as const) {
      for (const entry of getHorary249Table()) {
        const chart = calculateHoraryChart(
          { questionTime: OTHER_CASES.gw2000.input, horaryNumber: entry.number },
          OPTIONS(ayanamsa)
        );
        const d = diffArcsec(seSiderealAsc(OTHER_CASES.gw2000, ayanamsa, chart.armc), entry.startLongitude);
        expect(d, `${ayanamsa} number ${entry.number}`).toBeGreaterThanOrEqual(0);
        expect(d, `${ayanamsa} number ${entry.number}`).toBeLessThan(0.2);
      }
    }
  });
});

describe('the sky is the question instant, computed like calculateChart', () => {
  const natal = calculateChart(KL.input, OPTIONS('kp_old'));
  const horary = calculateHoraryChart({ questionTime: KL.input, horaryNumber: 145 }, OPTIONS('kp_old'));

  it('planets, speeds, lords, dasha and the ruling-planet day lord equal the chart at that instant', () => {
    expect(horary.planetPositions.map((p) => [p.name, p.tropicalLongitude, p.siderealLongitude, p.subSubLord]))
      .toEqual(natal.planetPositions.map((p) => [p.name, p.tropicalLongitude, p.siderealLongitude, p.subSubLord]));
    expect(horary.dashaBalance).toEqual(natal.dashaBalance);
    expect(horary.rulingPlanets.dayLord).toBe(natal.rulingPlanets.dayLord);
    expect(horary.rulingPlanets.dayLord).toBe('Mars'); // A.7, #36: sunrise, not midnight
    expect(horary.ayanamsaValue).toBe(natal.ayanamsaValue);
    expect(horary.julianDateUT).toBe(natal.julianDateUT);
  });

  it('planets match Appendix A.1 (Sun within 2", Moon within 6")', () => {
    const sun = horary.planetPositions.find((p) => p.name === 'Sun')!;
    const moon = horary.planetPositions.find((p) => p.name === 'Moon')!;
    expect(Math.abs(diffArcsec(sun.siderealLongitude, 326.9440666))).toBeLessThanOrEqual(2);
    expect(Math.abs(diffArcsec(moon.siderealLongitude, 42.0295069))).toBeLessThanOrEqual(6);
    // The Moon, and so the dasha, is the one at the question time (A.7: Moon dasha, 8.47787 y).
    expect(horary.dashaBalance.dashaLord).toBe('Moon');
  });

  it('only the houses differ: the cusps are the horary ones and planets take their house from them', () => {
    expect(horary.cusps[0].longitude).not.toBeCloseTo(natal.cusps[0].longitude, 3);
    const expected = assignPlanetsToHouses(
      horary.planets.map((p) => ({ name: p.name, longitude: p.longitude })),
      horary.cusps.map((c) => c.longitude),
      { nearBoundaryThresholdArcsec: 60 }
    );
    expect(horary.planets.map((p) => p.house)).toEqual(expected.map((p) => p.house));
    expect(horary.planetPositions.map((p) => p.house)).toEqual(expected.map((p) => p.house));
    expect(horary.rulingPlanets.ascendantStarLord).toBe(getHoraryEntry(145).starLord);
  });

  it('the sidereal time fields agree with the horary ARMC', () => {
    expect(horary.armc).toBeGreaterThanOrEqual(0);
    expect(horary.armc).toBeLessThan(360);
    expect(horary.localSiderealTimeDegrees).toBe(horary.armc);
    expect(horary.localSiderealTimeHours).toBeCloseTo(horary.armc / 15, 12);
    expect(normalizeDegrees(horary.greenwichApparentSiderealTime * 15 + KL.input.longitude)).toBeCloseTo(
      horary.armc,
      9
    );
    expect(horary.isPolarFallback).toBe(false);
    expect(horary.warnings.filter((w) => w.code === 'polar_fallback')).toEqual([]);
  });

  it('is assignable to a ChartCalculationResult with every additive field present', () => {
    const asChart: HoraryCalculationResult = horary;
    expect(asChart.significators.houseWise.length).toBe(12);
    expect(asChart.nodeAgentSignificators.rahuKetuRules.length).toBeGreaterThan(0);
    expect(asChart.chartWheels.southIndian.length).toBe(12);
  });
});

describe('midpoint toggle', () => {
  for (const n of NUMBERS) {
    it(`number ${n}: useSubMidpoint puts the lagna at (start + end) / 2`, () => {
      const entry = getHoraryEntry(n);
      const mid = (entry.startLongitude + entry.endLongitude) / 2;
      const chart = calculateHoraryChart(
        { questionTime: KL.input, horaryNumber: n, useSubMidpoint: true },
        OPTIONS('kp_old')
      );
      expect(chart.useSubMidpoint).toBe(true);
      expect(chart.lagnaTargetDeg).toBe(mid);
      expect(Math.abs(diffArcsec(chart.ascendant, mid))).toBeLessThan(0.001);
      // The midpoint is strictly inside the sub, so the lord is the table's.
      expect(chart.cusps[0].subLord).toBe(entry.subLord);
      expect(chart.cusps[0].horary249Number).toBe(n);
      // SE terms: the midpoint is half a sub from the start (the shortest sub, Sun in Rahu's star... > 0).
      const se = diffArcsec(seSiderealAsc(KL, 'kp_old', chart.armc), mid);
      expect(Math.abs(se)).toBeLessThanOrEqual(0.5);
    });

    it(`number ${n}: the default is the start, and it differs from the midpoint`, () => {
      const start = calculateHoraryChart({ questionTime: KL.input, horaryNumber: n }, OPTIONS('kp_old'));
      const mid = calculateHoraryChart(
        { questionTime: KL.input, horaryNumber: n, useSubMidpoint: true },
        OPTIONS('kp_old')
      );
      expect(start.useSubMidpoint).toBe(false);
      expect(start.ascendant).not.toBeCloseTo(mid.ascendant, 6);
      expect(start.armc).not.toBeCloseTo(mid.armc, 6);
    });
  }

  it('a non-boolean toggle throws', () => {
    expect(() =>
      calculateHoraryChart(
        { questionTime: KL.input, horaryNumber: 1, useSubMidpoint: 'yes' as unknown as boolean },
        OPTIONS('kp_old')
      )
    ).toThrow(TypeError);
  });
});

describe('inputs and options are checked, never defaulted', () => {
  it('horary numbers 0 and 250 throw, as do non-integers and NaN', () => {
    for (const bad of [0, 250, -1, 1.5, NaN, Infinity]) {
      expect(
        () => calculateHoraryChart({ questionTime: KL.input, horaryNumber: bad }, OPTIONS('kp_old')),
        `number ${bad}`
      ).toThrow(RangeError);
    }
    // The edges are accepted.
    expect(calculateHoraryChart({ questionTime: KL.input, horaryNumber: 1 }, OPTIONS('kp_old')).horaryNumber).toBe(1);
    expect(calculateHoraryChart({ questionTime: KL.input, horaryNumber: 249 }, OPTIONS('kp_old')).horaryNumber).toBe(249);
  });

  it('a missing option throws, and an unknown ayanamsa is rejected (no silent fallback)', () => {
    const { ayanamsa: _omit, ...rest } = OPTIONS('kp_old');
    expect(() =>
      calculateHoraryChart({ questionTime: KL.input, horaryNumber: 1 }, rest as unknown as ChartCalculationOptions)
    ).toThrow(/ayanamsa/);
    expect(() =>
      calculateHoraryChart(
        { questionTime: KL.input, horaryNumber: 1 },
        { ...OPTIONS('kp_old'), ayanamsa: 'lahiri2' as unknown as AyanamsaMode }
      )
    ).toThrow();
    expect(() =>
      calculateHoraryChart(
        { questionTime: { ...KL.input, utcOffsetHours: undefined }, horaryNumber: 1 },
        OPTIONS('kp_old')
      )
    ).toThrow(/utcOffsetHours/);
  });

  it('KP New moves the same lagna to a different ARMC and keeps it in the sub', () => {
    const o = calculateHoraryChart({ questionTime: KL.input, horaryNumber: 100 }, OPTIONS('kp_old'));
    const nw = calculateHoraryChart({ questionTime: KL.input, horaryNumber: 100 }, OPTIONS('kp_new'));
    expect(nw.ayanamsaValue - o.ayanamsaValue).toBeGreaterThan(0.02);
    expect(nw.armc).not.toBeCloseTo(o.armc, 3);
    expect(nw.cusps[0].horary249Number).toBe(100);
  });
});

describe('polar question place (#35, #58)', () => {
  const TROMSO: DateTimeLocation = {
    year: 2010, month: 12, day: 21, hour: 3, minute: 0, second: 0, utcOffsetHours: 0, latitude: 69.6492, longitude: 18.9553,
  };

  it('throws PolarLatitudeError: horary has no Porphyry fallback (#58)', () => {
    // Documented in `calculateHoraryChart`: the Ascendant is not one-to-one in the ARMC inside the
    // polar circle, so there is no unique ARMC to build the chart from. #29 (owner, 2026-11-21)
    // makes Porphyry the polar behaviour of natal charts only.
    expect(isPolarLatitude(TROMSO.latitude, 23.4378)).toBe(true);
    expect(() =>
      calculateHoraryChart({ questionTime: TROMSO, horaryNumber: 100 }, OPTIONS('kp_old'))
    ).toThrow(PolarLatitudeError);
  });

  it('66.5 N is not polar: Placidus, lagna on the sub start, no clamp (#35)', () => {
    const chart = calculateHoraryChart(
      { questionTime: { ...TROMSO, latitude: 66.5 }, horaryNumber: 100 },
      OPTIONS('kp_old')
    );
    expect(chart.isPolarFallback).toBe(false);
    expect(chart.cusps[0].horary249Number).toBe(100);
    expect(chart.warnings.filter((w) => w.code === 'polar_fallback')).toEqual([]);
  });

  it('every number is reachable at 66.5 N and at a southern latitude', () => {
    for (const lat of [66.5, -45]) {
      for (const entry of getHorary249Table()) {
        const chart = calculateHoraryChart(
          { questionTime: { ...KL.input, latitude: lat }, horaryNumber: entry.number },
          OPTIONS('kp_old')
        );
        expect(chart.cusps[0].horary249Number, `lat ${lat} number ${entry.number}`).toBe(entry.number);
      }
    }
  });
});
