import { describe, it, expect } from 'vitest';
import { calculateKPChart } from '../src/engine/index.js';
import {
  calculateSignificators,
  calculateNodeAgents,
  calculateFourLevelSignificators,
  NODE_AGENT_RULE_SET_DESCRIPTIONS,
} from '../src/engine/significators.js';
import { buildChartWheels } from '../src/engine/chart-wheels.js';
import { buildKPCusp } from '../src/engine/kp-lords.js';
import { assignPlanetsToHouses } from '../src/engine/house-assignment.js';
import type { NodeAgentRuleSet } from '../src/engine/types.js';

describe('Significators and Chart Wheels', () => {
  const sampleData = {
    year: 1947,
    month: 8,
    day: 14,
    hour: 18,
    minute: 30,
    second: 0,
    latitude: 28.6139,
    longitude: 77.209,
  };

  const samplePlanets = [
    { name: 'Sun', longitude: 118.0 },    // Cancer
    { name: 'Moon', longitude: 84.0 },    // Gemini
    { name: 'Mars', longitude: 67.0 },    // Gemini
    { name: 'Mercury', longitude: 114.0 }, // Cancer
    { name: 'Jupiter', longitude: 211.0 }, // Libra
    { name: 'Venus', longitude: 105.0 },  // Cancer
    { name: 'Saturn', longitude: 110.0 }, // Cancer
    { name: 'Rahu', longitude: 35.0 },    // Taurus
    { name: 'Ketu', longitude: 215.0 },   // Scorpio
  ];

  it('computes 4-level significators for all 12 houses', () => {
    const chart = calculateKPChart(sampleData, 'kp_old', samplePlanets);

    expect(chart.significators).toBeDefined();
    expect(chart.significators!.houseWise).toHaveLength(12);
    expect(chart.significators!.planetWise).toHaveLength(samplePlanets.length);

    // Each house must have level 1..4 arrays defined
    for (const hw of chart.significators!.houseWise) {
      expect(hw.house).toBeGreaterThanOrEqual(1);
      expect(hw.house).toBeLessThanOrEqual(12);
      expect(Array.isArray(hw.level1)).toBe(true);
      expect(Array.isArray(hw.level2)).toBe(true);
      expect(Array.isArray(hw.level3)).toBe(true);
      expect(Array.isArray(hw.level4)).toBe(true);
      // Level 4 is always the cusp sign lord (non-empty)
      expect(hw.level4.length).toBeGreaterThan(0);
    }
  });

  it('builds South Indian and North Indian chart wheel models', () => {
    const chart = calculateKPChart(sampleData, 'kp_old', samplePlanets);

    expect(chart.chartWheels).toBeDefined();
    // South Indian has 12 boxes (one per zodiac sign)
    expect(chart.chartWheels!.southIndian).toHaveLength(12);
    // North Indian has 12 houses (one per house)
    expect(chart.chartWheels!.northIndian).toHaveLength(12);

    // Verify all 12 cusps are accounted for in South Indian chart
    const totalCuspsInSouthIndian = chart.chartWheels!.southIndian.reduce(
      (sum, box) => sum + box.cusps.length,
      0
    );
    expect(totalCuspsInSouthIndian).toBe(12);

    // Verify all planets are accounted for in North Indian chart
    const totalPlanetsInNorthIndian = chart.chartWheels!.northIndian.reduce(
      (sum, house) => sum + house.planets.length,
      0
    );
    expect(totalPlanetsInNorthIndian).toBe(samplePlanets.length);
  });
});

// ---------------------------------------------------------------------------
// KL 1992 fixture (work package port-significators, #46)
//
// Inputs: docs/build-fix/audit.md Appendix A.1 (Swiss Ephemeris 2.10.03), KP Old, mean node,
// 1992-03-11 06:14 +08:00, Kuala Lumpur. Sidereal longitudes in degrees.
// ---------------------------------------------------------------------------

const KL1992_PLANETS = [
  { name: 'Sun', longitude: 326.9440666 },
  { name: 'Moon', longitude: 42.0295069 },
  { name: 'Mars', longitude: 293.0611426 },
  { name: 'Mercury', longitude: 345.0414661 },
  { name: 'Jupiter', longitude: 134.6139223 },
  { name: 'Venus', longitude: 302.5516451 },
  { name: 'Saturn', longitude: 290.2731592 },
  { name: 'Rahu', longitude: 252.4479023 },
  { name: 'Ketu', longitude: 72.4479023 },
];

const KL1992_CUSPS = [
  307.7290202, 340.7950541, 12.9507306, 42.2556138, 69.6173188, 97.382202, 127.7290202,
  160.7950541, 192.9507306, 222.2556138, 249.6173188, 277.382202,
];

type Levels = { level1: string[]; level2: string[]; level3: string[]; level4: string[] };

/**
 * House-wise levels as Stack A (`src/engine/significators.ts`) produces them today for the KL 1992
 * inputs above. Order follows the input planet order.
 */
const KL1992_HOUSE_LEVELS_A: Record<number, Levels> = {
  1: { level1: [], level2: ['Sun'], level3: ['Mercury'], level4: ['Saturn'] },
  2: { level1: [], level2: ['Mercury'], level3: ['Sun'], level4: ['Jupiter'] },
  3: { level1: ['Moon', 'Mars', 'Saturn'], level2: ['Moon'], level3: ['Venus'], level4: ['Mars'] },
  4: { level1: [], level2: [], level3: ['Jupiter'], level4: ['Venus'] },
  5: { level1: ['Rahu'], level2: ['Ketu'], level3: [], level4: ['Mercury'] },
  6: { level1: [], level2: [], level3: ['Moon', 'Mars', 'Saturn'], level4: ['Moon'] },
  7: { level1: ['Sun'], level2: ['Jupiter'], level3: [], level4: ['Sun'] },
  8: { level1: [], level2: [], level3: [], level4: ['Mercury'] },
  9: { level1: [], level2: [], level3: ['Jupiter'], level4: ['Venus'] },
  10: { level1: [], level2: [], level3: ['Venus'], level4: ['Mars'] },
  11: { level1: ['Ketu'], level2: ['Rahu'], level3: ['Sun'], level4: ['Jupiter'] },
  12: {
    level1: ['Mercury', 'Jupiter', 'Venus'],
    level2: ['Mars', 'Venus', 'Saturn'],
    level3: ['Mercury'],
    level4: ['Saturn'],
  },
};

/**
 * The same chart through Stack B's `calculateSignificators` (`src/kp/significators.ts`), captured
 * when this package was written, before Stack B is deleted. Identical to Stack A in all 48 level
 * lists as sets; the only difference is list ORDER in house 12 level 1 (B walks occupants first).
 */
const KL1992_HOUSE_LEVELS_B: Record<number, Levels> = {
  ...KL1992_HOUSE_LEVELS_A,
  12: {
    level1: ['Venus', 'Jupiter', 'Mercury'],
    level2: ['Mars', 'Venus', 'Saturn'],
    level3: ['Mercury'],
    level4: ['Saturn'],
  },
};

const KL1992_PLANET_HOUSES_ALL: Record<string, number[]> = {
  Sun: [1, 2, 7, 11],
  Moon: [3, 6],
  Mars: [3, 6, 10, 12],
  Mercury: [1, 2, 5, 8, 12],
  Jupiter: [2, 4, 7, 9, 11, 12],
  Venus: [3, 4, 9, 10, 12],
  Saturn: [1, 3, 6, 12],
  Rahu: [5, 11],
  Ketu: [5, 11],
};

function buildKl1992() {
  const cusps = KL1992_CUSPS.map((c, i) => buildKPCusp(i + 1, c, KL1992_CUSPS[(i + 1) % 12]));
  const planets = assignPlanetsToHouses(KL1992_PLANETS, KL1992_CUSPS);
  return { cusps, planets };
}

const sorted = (xs: string[]) => [...xs].sort();

describe('Four-level significators, KL 1992 fixture (Appendix A.1, KP Old, mean node)', () => {
  const { cusps, planets } = buildKl1992();

  it('assigns the planets to the cuspal houses the fixture expects', () => {
    const houses = Object.fromEntries(planets.map((p) => [p.name, p.house]));
    expect(houses).toEqual({
      Sun: 1,
      Moon: 3,
      Mars: 12,
      Mercury: 2,
      Jupiter: 7,
      Venus: 12,
      Saturn: 12,
      Rahu: 11,
      Ketu: 5,
    });
  });

  it('house-wise levels equal the pinned Stack A fixture, in order', () => {
    const result = calculateSignificators(cusps, planets);
    for (let h = 1; h <= 12; h++) {
      const hw = result.houseWise[h - 1];
      expect(hw.house).toBe(h);
      expect({ level1: hw.level1, level2: hw.level2, level3: hw.level3, level4: hw.level4 }).toEqual(
        KL1992_HOUSE_LEVELS_A[h]
      );
    }
  });

  it('Stack A and Stack B agree on all 48 house levels (0 of 48 differ as sets)', () => {
    const result = calculateSignificators(cusps, planets);
    let differing = 0;
    for (let h = 1; h <= 12; h++) {
      const hw = result.houseWise[h - 1];
      for (const level of ['level1', 'level2', 'level3', 'level4'] as const) {
        if (JSON.stringify(sorted(hw[level])) !== JSON.stringify(sorted(KL1992_HOUSE_LEVELS_B[h][level]))) {
          differing++;
        }
      }
    }
    expect(differing).toBe(0);
  });

  it('planet-wise houses (all levels) match the fixture', () => {
    const result = calculateSignificators(cusps, planets);
    for (const pw of result.planetWise) {
      expect(pw.signifiesHouses.all).toEqual(KL1992_PLANET_HOUSES_ALL[pw.planet]);
    }
  });
});

describe('Rahu/Ketu agents (TODO(#23): rule set is an owner decision, no default)', () => {
  const { cusps, planets } = buildKl1992();

  it("'sign_lord_star_lord_same_sign' matches Stack B's agentsFor for KL 1992 (current behaviour, not an endorsed rule)", () => {
    const agents = calculateNodeAgents(planets, 'sign_lord_star_lord_same_sign');
    // audit.md section 2.6: KL 1992 Rahu -> [Jupiter, Ketu]. Stack B gives Ketu -> [Mercury, Rahu].
    expect(agents.Rahu).toEqual(['Jupiter', 'Ketu']);
    expect(agents.Ketu).toEqual(['Mercury', 'Rahu']);
  });

  it("'none' lists no agents", () => {
    expect(calculateNodeAgents(planets, 'none')).toEqual({ Rahu: [], Ketu: [] });
  });

  it('refuses a missing or unknown rule set instead of picking one', () => {
    expect(() => calculateNodeAgents(planets, undefined as unknown as NodeAgentRuleSet)).toThrow(
      /rule set/i
    );
    expect(() => calculateNodeAgents(planets, 'standard' as unknown as NodeAgentRuleSet)).toThrow(
      /rule set/i
    );
    expect(() =>
      calculateFourLevelSignificators(cusps, planets, undefined as unknown as NodeAgentRuleSet)
    ).toThrow(/rule set/i);
  });

  it('includes other planets in the same sign, excluding the node itself', () => {
    // Rahu 252.45 deg is in Sagittarius; put Mars and Venus in Sagittarius too.
    const custom = assignPlanetsToHouses(
      [
        { name: 'Mars', longitude: 245.0 },
        { name: 'Venus', longitude: 265.0 },
        { name: 'Sun', longitude: 100.0 },
        { name: 'Rahu', longitude: 252.4479023 },
        { name: 'Ketu', longitude: 72.4479023 },
      ],
      KL1992_CUSPS
    );
    const agents = calculateNodeAgents(custom, 'sign_lord_star_lord_same_sign');
    // sign lord Jupiter, star lord Ketu, then same-sign planets in Sun..Ketu order.
    expect(agents.Rahu).toEqual(['Jupiter', 'Ketu', 'Mars', 'Venus']);
    expect(agents.Rahu).not.toContain('Rahu');
    expect(agents.Rahu).not.toContain('Sun');
  });

  it('can contain the node itself (documented current behaviour of this rule set)', () => {
    // 70 deg is Gemini, Ardra: sign lord Mercury, star lord Rahu.
    const custom = assignPlanetsToHouses(
      [
        { name: 'Rahu', longitude: 70.0 },
        { name: 'Ketu', longitude: 250.0 },
      ],
      KL1992_CUSPS
    );
    const agents = calculateNodeAgents(custom, 'sign_lord_star_lord_same_sign');
    expect(agents.Rahu).toEqual(['Mercury', 'Rahu']);
  });

  it('gives an empty list for a node that is absent from the input', () => {
    const noNodes = planets.filter((p) => p.name !== 'Rahu' && p.name !== 'Ketu');
    expect(calculateNodeAgents(noNodes, 'sign_lord_star_lord_same_sign')).toEqual({
      Rahu: [],
      Ketu: [],
    });
  });

  it('the four house levels do not depend on the rule set', () => {
    const base = calculateSignificators(cusps, planets);
    const rulesets: NodeAgentRuleSet[] = ['none', 'sign_lord_star_lord_same_sign'];
    const results = rulesets.map((r) => calculateFourLevelSignificators(cusps, planets, r));
    for (const result of results) {
      for (const hw of base.houseWise) {
        expect(result.houseWise[hw.house]).toEqual({
          level1: hw.level1,
          level2: hw.level2,
          level3: hw.level3,
          level4: hw.level4,
        });
      }
    }
    expect(results[0].houseWise).toEqual(results[1].houseWise);
  });

  it('puts agents only on Rahu and Ketu in the Stack B layout', () => {
    const result = calculateFourLevelSignificators(cusps, planets, 'sign_lord_star_lord_same_sign');
    expect(result.planetWise.Rahu.agentsFor).toEqual(['Jupiter', 'Ketu']);
    expect(result.planetWise.Ketu.agentsFor).toEqual(['Mercury', 'Rahu']);
    expect(result.planetWise.Sun.agentsFor).toEqual([]);
    // Houses by level, from the fixture.
    expect(result.planetWise.Rahu.level1Houses).toEqual([5]);
    expect(result.planetWise.Rahu.level2Houses).toEqual([11]);
    const none = calculateFourLevelSignificators(cusps, planets, 'none');
    expect(none.planetWise.Rahu.agentsFor).toEqual([]);
    expect(none.planetWise.Ketu.agentsFor).toEqual([]);
  });

  it('documents the rule set truthfully: no aspects', () => {
    const text = NODE_AGENT_RULE_SET_DESCRIPTIONS.sign_lord_star_lord_same_sign;
    expect(text).toMatch(/Aspects are NOT implemented/);
    expect(text).not.toMatch(/casting aspects/i);
    const result = calculateFourLevelSignificators(cusps, planets, 'sign_lord_star_lord_same_sign');
    expect(result.rahuKetuRules).toBe(text);
    expect(calculateFourLevelSignificators(cusps, planets, 'none').rahuKetuRules).toBe(
      NODE_AGENT_RULE_SET_DESCRIPTIONS.none
    );
  });
});
