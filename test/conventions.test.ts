/**
 * Fixed KP conventions (work package `apply-decisions`, #62). Every convention here is an owner
 * decision recorded on #29 (owner, 2026-11-21); `src/engine/conventions.ts` holds them together.
 *
 * Reference values: docs/build-fix/audit.md Appendix A.5 (Swiss Ephemeris 2.10.03, Tromso
 * 2010-12-21 03:00 UTC, KP Old: Porphyry cusps, since SE switches to Porphyry above the polar
 * circle). Tolerance 0.1 arcsec, as in `placidus.test.ts`.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  DASHA_YEAR_DAYS,
  INCLUDES_OUTER_PLANETS,
  LUNAR_NODE,
  NEAR_BOUNDARY_THRESHOLD_ARCSEC,
  POLAR_HANDLING,
  SUNRISE_DEFINITION,
} from '../src/engine/conventions.js';
import {
  calculateChart,
  calculateCuspsFromARMC,
  calculateKPChart,
  getPositionLords,
  PolarLatitudeError,
} from '../src/engine/index.js';
import { calculateVimshottariDasha, getDashaAtBirth } from '../src/engine/dasha.js';
import type {
  AyanamsaMode,
  ChartCalculationOptions,
  DateTimeLocation,
  NodeAgentRuleSet,
  RulingPlanetSet,
} from '../src/engine/types.js';

const TROMSO: DateTimeLocation = {
  year: 2010, month: 12, day: 21, hour: 3, minute: 0, second: 0,
  utcOffsetHours: 0, latitude: 69.6492, longitude: 18.9553,
};
const KL: DateTimeLocation = {
  year: 1992, month: 3, day: 11, hour: 6, minute: 14, second: 0,
  utcOffsetHours: 8, latitude: 3.139, longitude: 101.6869,
};

/** Appendix A.5, KP Old, cusps 1 to 12 (sidereal degrees). */
const A5_KP_OLD = [
  187.231406, 227.355269, 267.479133, 307.602996, 327.479133, 347.355269,
  7.231406, 47.355269, 87.479133, 127.602996, 147.479133, 167.355269,
];

const diffArcsec = (a: number, b: number): number => {
  let d = a - b;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return Math.abs(d) * 3600;
};

// The three required options (#22 decided: no API default; TODO(#23), TODO(#24)).
const OPTIONS: ChartCalculationOptions = {
  ayanamsa: 'kp_old',
  nodeAgentRuleSet: 'none',
  rulingPlanetSet: 'asc_star_sign_moon_star_sign_day_lord',
};

describe('conventions.ts pins the owner decisions of #29 (owner, 2026-11-21)', () => {
  it('dasha year is 365.2425 days', () => {
    expect(DASHA_YEAR_DAYS).toBe(365.2425);
  });

  it('near-boundary threshold is 60 arcsec', () => {
    expect(NEAR_BOUNDARY_THRESHOLD_ARCSEC).toBe(60);
  });

  it('mean node only, no outer planets, Porphyry at polar latitudes, upper-limb sunrise', () => {
    expect(LUNAR_NODE).toBe('mean');
    expect(INCLUDES_OUTER_PLANETS).toBe(false);
    expect(POLAR_HANDLING).toBe('porphyry_fallback');
    expect(SUNRISE_DEFINITION).toBe('upper_limb_refraction');
  });
});

describe('ChartCalculationOptions has exactly the three open decisions', () => {
  it('keys are ayanamsa, nodeAgentRuleSet and rulingPlanetSet (#22 decided; TODO(#23), TODO(#24))', () => {
    expectTypeOf<keyof ChartCalculationOptions>().toEqualTypeOf<
      'ayanamsa' | 'nodeAgentRuleSet' | 'rulingPlanetSet'
    >();
    expectTypeOf<ChartCalculationOptions['ayanamsa']>().toEqualTypeOf<AyanamsaMode>();
    expectTypeOf<ChartCalculationOptions['nodeAgentRuleSet']>().toEqualTypeOf<NodeAgentRuleSet>();
    expectTypeOf<ChartCalculationOptions['rulingPlanetSet']>().toEqualTypeOf<RulingPlanetSet>();
    expectTypeOf<Required<ChartCalculationOptions>>().toEqualTypeOf<ChartCalculationOptions>();
    expect(true).toBe(true);
  });

  it('the removed options are rejected by the type checker (and ignored at runtime)', () => {
    // @ts-expect-error nodeMode was removed: mean node only
    const a: ChartCalculationOptions = { ...OPTIONS, nodeMode: 'TRUE' };
    // @ts-expect-error includeOuterPlanets was removed
    const b: ChartCalculationOptions = { ...OPTIONS, includeOuterPlanets: true };
    // @ts-expect-error polarHandling was removed: always Porphyry fallback
    const c: ChartCalculationOptions = { ...OPTIONS, polarHandling: 'refuse' };
    for (const o of [a, b, c]) {
      const chart = calculateChart(KL, o);
      expect(chart.planets).toHaveLength(9);
    }
  });
});

describe('polar latitude: Porphyry fallback with a visible warning, without any option', () => {
  const chart = calculateChart(TROMSO, OPTIONS);

  it('calculateChart at Tromso returns Porphyry cusps within 0.1" of Swiss Ephemeris (A.5)', () => {
    expect(chart.cusps).toHaveLength(12);
    chart.cusps.forEach((c, i) => {
      expect(diffArcsec(c.longitude, A5_KP_OLD[i]), `cusp ${i + 1}`).toBeLessThanOrEqual(0.1);
    });
  });

  it('isPolarFallback is true and a polar_fallback warning is returned', () => {
    expect(chart.isPolarFallback).toBe(true);
    const polar = chart.warnings.filter((w) => w.code === 'polar_fallback');
    expect(polar).toHaveLength(1);
    expect(polar[0].message).toMatch(/Porphyry/);
  });

  it('the legacy calculateKPChart at Tromso returns Porphyry + warning instead of throwing', () => {
    const legacy = calculateKPChart(TROMSO, 'kp_old');
    expect(legacy.isPolarFallback).toBe(true);
    expect(legacy.warnings?.filter((w) => w.code === 'polar_fallback')).toHaveLength(1);
    expect(legacy.cusps).toHaveLength(12);
    // Porphyry: cusps 1 and 10 are the Ascendant and MC, and 7 and 4 are their opposites.
    expect(diffArcsec(legacy.cusps[6].longitude, legacy.cusps[0].longitude + 180)).toBeLessThan(1e-6);
    expect(diffArcsec(legacy.cusps[3].longitude, legacy.cusps[9].longitude + 180)).toBeLessThan(1e-6);
    expect(legacy.cusps[0].longitude).toBeCloseTo(legacy.ascendant, 9);
  });

  it('a non-polar chart is Placidus: no fallback flag, no polar warning', () => {
    const kl = calculateChart(KL, OPTIONS);
    expect(kl.isPolarFallback).toBe(false);
    expect(kl.warnings.some((w) => w.code === 'polar_fallback')).toBe(false);
    expect(calculateKPChart(KL, 'kp_old').isPolarFallback).toBe(false);
  });

  it('calculateCuspsFromARMC returns bare cusps, so it throws instead of falling back silently', () => {
    expect(() => calculateCuspsFromARMC(100, TROMSO.latitude)).toThrow(PolarLatitudeError);
  });
});

describe('dasha year 365.2425 days', () => {
  it('KL 1992: the balance dasha lasts balanceYears x 365.2425 days and a full Mars dasha 7 x 365.2425', () => {
    const chart = calculateChart(KL, OPTIONS);
    const moon = chart.planets.find((p) => p.name === 'Moon')!;
    const birth = getDashaAtBirth(moon.longitude);
    const d = calculateVimshottariDasha(moon.longitude, new Date('1992-03-10T22:14:00Z'));
    expect(d.dashaTimeline[0].lord).toBe('Moon');
    expect(d.dashaTimeline[0].durationDays).toBe(Math.round(birth.balanceYears * 365.2425));
    expect(d.dashaTimeline[1].lord).toBe('Mars');
    expect(d.dashaTimeline[1].durationDays).toBe(Math.round(7 * 365.2425));
    expect(chart.dashaBalance).toEqual(d);
  });
});

describe('near-boundary threshold 60 arcsec', () => {
  it('calculateChart flags a body or cusp exactly when getPositionLords does at 60"', () => {
    const chart = calculateChart(KL, OPTIONS);
    for (const p of [...chart.cusps, ...chart.planets]) {
      const ref = getPositionLords(p.longitude, { nearBoundaryThresholdArcsec: NEAR_BOUNDARY_THRESHOLD_ARCSEC });
      expect(p.isNearSubBoundary).toBe(ref.isNearSubBoundary);
      expect(p.isNearSubSubBoundary).toBe(ref.isNearSubSubBoundary);
    }
  });

  it('a longitude 59" from a sub edge is flagged, one 61" away is not', () => {
    // 42.0295069 (KL 1992 Moon, KP Old) is in a sub that is 7200" long, so 59" and 61" from its
    // start are both well inside it.
    const lords = getPositionLords(42.0295069, { nearBoundaryThresholdArcsec: 0 });
    const start = lords.subSpanStart!;
    expect((lords.subSpanEnd! - start) * 3600).toBeCloseTo(7200, 3);
    const at = (arcsec: number) =>
      getPositionLords(start + arcsec / 3600, { nearBoundaryThresholdArcsec: NEAR_BOUNDARY_THRESHOLD_ARCSEC });
    expect(at(59).isNearSubBoundary).toBe(true);
    expect(at(61).isNearSubBoundary).toBe(false);
  });
});
