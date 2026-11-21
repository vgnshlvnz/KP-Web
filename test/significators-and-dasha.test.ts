import { describe, it, expect } from 'vitest';
import { calculateChart } from '../src/engine/index.js';
import { getBhuktiYears, getDashaAtBirth } from '../src/engine/dasha.js';
import { NODE_AGENT_RULE_SET_DESCRIPTIONS } from '../src/engine/significators.js';
import type { ChartCalculationOptions } from '../src/engine/types.js';

/**
 * Re-pointed from the Stack B `calculateNatalChart` (src/kp/engine) to `calculateChart` (#54).
 *
 * Every option below is a test fixture, not a default: each is an open owner decision.
 * They reproduce what Stack B did here (KP Old, mean node, its Rahu/Ketu agents, its 5-entry
 * ruling-planet list, 365.2425-day dasha year, 60 arcsec boundary threshold, outer planets listed).
 */
const OPTIONS: ChartCalculationOptions = {
  ayanamsa: 'kp_old',
  nodeMode: 'MEAN',
  nodeAgentRuleSet: 'sign_lord_star_lord_same_sign', // TODO(#23)
  rulingPlanetSet: 'asc_star_sign_moon_star_sign_day_lord', // TODO(#24)
  dashaYearDays: 365.2425, // TODO(#29 Q9)
  polarHandling: 'porphyry_fallback', // TODO(#29 Q7)
  sunriseDefinition: 'upper_limb_refraction', // TODO(#29 Q8)
  nearBoundaryThresholdArcsec: 60, // TODO(#29 Q10)
  includeOuterPlanets: true, // TODO(#29 Q12): Stack B returned 12 planets
};

describe('Natal chart engine', () => {
  it('Calculates full Natal Chart with 4-level significators, ruling planets, and dasha', () => {
    const chart = calculateChart(
      {
        year: 1990,
        month: 5,
        day: 15,
        hour: 20,
        minute: 0,
        second: 0,
        utcOffsetHours: 5.5, // 20:00:00 IST = 14:30:00 UTC
        latitude: 13.0827,
        longitude: 80.2707,
      },
      OPTIONS
    );

    // Verify chart basics
    expect(chart.planets.length).toBe(12);
    expect(chart.cusps.length).toBe(12);
    expect(chart.ayanamsaType).toBe('kp_old');
    expect(chart.ayanamsaValue > 23.6 && chart.ayanamsaValue < 23.7).toBe(true);

    // Ascendant verification
    expect(chart.ascendant > 0).toBe(true);
    expect(chart.cusps[0].signLord).toBeTruthy();
    expect(chart.cusps[0].starLord).toBeTruthy();
    expect(chart.cusps[0].subLord).toBeTruthy();

    // Four-level significators structure
    for (let h = 1; h <= 12; h++) {
      const houseSig = chart.nodeAgentSignificators.houseWise[h];
      expect(houseSig, `House ${h} significators missing`).toBeTruthy();
      expect(Array.isArray(houseSig.level1)).toBe(true);
      expect(Array.isArray(houseSig.level2)).toBe(true);
      expect(Array.isArray(houseSig.level3)).toBe(true);
      expect(Array.isArray(houseSig.level4)).toBe(true);
    }

    // Rahu / Ketu rules documented. Stack B's text ("Standard KP School", which also claimed
    // aspects that were never implemented) is not carried over: the rule set is TODO(#23), and the
    // text is now the description of the named option that was passed.
    expect(chart.nodeAgentSignificators.rahuKetuRules).toBe(
      NODE_AGENT_RULE_SET_DESCRIPTIONS[OPTIONS.nodeAgentRuleSet]
    );

    // Ruling planets (sunrise exists here, so there is a day lord)
    const rp = chart.rulingPlanets;
    expect(rp.ascendantSignLord).toBeTruthy();
    expect(rp.ascendantStarLord).toBeTruthy();
    expect(rp.moonSignLord).toBeTruthy();
    expect(rp.moonStarLord).toBeTruthy();
    expect(rp.dayLord).toBeTruthy();
    expect(rp.rulingPlanetsList.length).toBe(5);

    // Vimshottari Dasha
    expect(chart.dashaBalance.birthStar).toBeTruthy();
    expect(chart.dashaBalance.dashaLord).toBeTruthy();
    expect(chart.dashaBalance.balanceYears >= 0).toBe(true);
    expect(chart.dashaBalance.dashaTimeline.length).toBe(9);

    // The first dasha is the balance dasha. It does NOT list nine bhuktis: the ones already over at
    // birth are skipped and the running one is cut (#37, audit A.7). It starts at the running
    // bhukti, and the running bhukti starts at the running antara.
    const moon = chart.planets.find((p) => p.name === 'Moon')!;
    const birth = getDashaAtBirth(moon.longitude);
    const firstDasha = chart.dashaBalance.dashaTimeline[0];
    expect(firstDasha.lord).toBe(birth.dashaLord);
    const fullBhuktis = getBhuktiYears(birth.dashaLord).map((b) => b.lord);
    const runningIndex = fullBhuktis.indexOf(birth.running.bhukti.lord);
    expect(firstDasha.subPeriods!.map((b) => b.lord)).toEqual(fullBhuktis.slice(runningIndex));
    const firstBhukti = firstDasha.subPeriods![0];
    expect(firstBhukti.lord).toBe(birth.running.bhukti.lord);
    expect(firstBhukti.subPeriods![0].lord).toBe(birth.running.antara.lord);
    // A later bhukti is whole: nine antaras.
    expect(firstDasha.subPeriods![firstDasha.subPeriods!.length - 1].subPeriods!.length).toBe(9);
  });

  it('KL 1992-03-11 06:14 +08:00: first dasha is Moon, running bhukti is Rahu, 7 bhuktis follow (#37, audit A.7)', () => {
    const chart = calculateChart(
      {
        year: 1992,
        month: 3,
        day: 11,
        hour: 6,
        minute: 14,
        second: 0,
        utcOffsetHours: 8,
        latitude: 3.139,
        longitude: 101.6869,
      },
      OPTIONS
    );
    // A.7: Moon dasha, balance 8.477870 y, running bhukti Rahu with 1.394536 y left. The Moon is
    // within 6 arcsec of SE, which moves these by at most 6/48000 x 10 y = 1.25e-3 y.
    const birth = getDashaAtBirth(chart.planets.find((p) => p.name === 'Moon')!.longitude);
    expect(birth.dashaLord).toBe('Moon');
    expect(Math.abs(birth.balanceYears - 8.47787)).toBeLessThan(1.3e-3);
    expect(birth.running.bhukti.lord).toBe('Rahu');
    expect(Math.abs(birth.running.bhukti.yearsLeft - 1.394536)).toBeLessThan(1.3e-3);

    const first = chart.dashaBalance.dashaTimeline[0];
    expect(first.lord).toBe('Moon');
    expect(first.subPeriods!.map((b) => b.lord)).toEqual([
      'Rahu', 'Jupiter', 'Saturn', 'Mercury', 'Ketu', 'Venus', 'Sun',
    ]);
    // Day lord at sunrise (#36): the moment is before 07:21 local sunrise, so Mars, not Mercury.
    expect(chart.rulingPlanets.dayLord).toBe('Mars');
  });
});
