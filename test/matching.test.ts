/**
 * Horoscope Matching (KP Dasavidha Porutham), work package `horoscope-matching` (#100).
 *
 * Merged from two branches, no case removed: the per-rule pure functions and the end-to-end
 * fixture from `build/horoscope-match`; the `calculateMatch` structure, per-rule input and
 * input-validation checks from `build/matching-core`. The route is tested in `matching-api.test.ts`.
 *
 * Rules 2, 5, 9 omitted (owner, 2026-11-22); see `src/engine/matching.ts`.
 *
 * The expected marks are hand-derived from THIS engine's own `calculateChart` output, not copied
 * from KP-Qt's computed marks (KP-Qt's reference charts have baseline lord, dasha and sub errors).
 * TODO: once a reference check against kp-reference (or Swiss Ephemeris) is possible, add
 * score-level expectations from it.
 */
import { describe, expect, it } from 'vitest';
import { calculateChart, calculateMatch, MATCH_RULE4_ORB_DEG } from '../src/engine/index.js';
import { calculateVimshottariDasha } from '../src/engine/dasha.js';
import type {
  ChartCalculationOptions,
  DashaPeriod,
  DateTimeLocation,
  KPPlanetLord,
  MatchInput,
} from '../src/engine/types.js';
import {
  regards,
  directionPair,
  rule3Score,
  rule4Score,
  isBeneficHouse,
  lordScore,
  significatorScore,
  dashaLordsAt,
  localNoonUtc,
  MatchingDateOutOfRangeError,
  MAX_TOTAL_MARKS,
} from '../src/engine/matching.js';

// ---------------------------------------------------------------------------
// Rule 1: BPHS friendship (synthetic inputs)
// ---------------------------------------------------------------------------

describe('regards (BPHS 3.55 natural friendship)', () => {
  it('a planet regards itself as a friend', () => {
    expect(regards('Sun', 'Sun')).toBe(0);
  });

  it('Sun regards Venus as an enemy, but Venus regards Sun as an enemy too (asymmetric table, same cell here)', () => {
    expect(regards('Sun', 'Venus')).toBe(2);
    expect(regards('Venus', 'Sun')).toBe(2);
  });

  it('is asymmetric: Moon regards Mercury as a friend, but Mercury regards Moon as an enemy', () => {
    expect(regards('Moon', 'Mercury')).toBe(0);
    expect(regards('Mercury', 'Moon')).toBe(2);
  });

  it('Rahu takes Saturn\'s row and column, Ketu takes Mars\'s', () => {
    expect(regards('Rahu', 'Mercury')).toBe(regards('Saturn', 'Mercury'));
    expect(regards('Ketu', 'Jupiter')).toBe(regards('Mars', 'Jupiter'));
  });
});

describe('directionPair (rule 1 scoring)', () => {
  it('scores both halves when neither direction is an enemy', () => {
    expect(directionPair('Sun', 'Moon', 100)).toBe(100);
  });

  it('drops the half where that direction regards the other as an enemy', () => {
    // Sun->Venus enemy, Venus->Sun enemy: both halves lost.
    expect(directionPair('Sun', 'Venus', 100)).toBe(0);
  });

  it('drops only the enemy direction when the regard is asymmetric', () => {
    // Mercury->Venus is friend; Venus->Mercury is friend too, so pick a genuinely asymmetric enemy case:
    // Jupiter->Venus is enemy, Venus->Jupiter is neutral.
    expect(regards('Jupiter', 'Venus')).toBe(2);
    expect(regards('Venus', 'Jupiter')).toBe(1);
    expect(directionPair('Jupiter', 'Venus', 100)).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// Rule 3: Asc sign elements
// ---------------------------------------------------------------------------

describe('rule3Score (Asc sign element compatibility)', () => {
  it('fire-fire is compatible (Aries=0, Leo=4)', () => {
    expect(rule3Score(0, 4)).toBe(100);
  });

  it('water-water is compatible (Cancer=3, Scorpio=7)', () => {
    expect(rule3Score(3, 7)).toBe(100);
  });

  it('fire-air is compatible (Aries=0, Gemini=2)', () => {
    expect(rule3Score(0, 2)).toBe(100);
  });

  it('earth-water is compatible (Taurus=1, Cancer=3)', () => {
    expect(rule3Score(1, 3)).toBe(100);
  });

  it('air-water is compatible (Gemini=2, Cancer=3)', () => {
    expect(rule3Score(2, 3)).toBe(100);
  });

  it('fire-earth is incompatible (Aries=0, Taurus=1)', () => {
    expect(rule3Score(0, 1)).toBe(0);
  });

  it('is symmetric in its two arguments', () => {
    expect(rule3Score(1, 3)).toBe(rule3Score(3, 1));
  });
});

// ---------------------------------------------------------------------------
// Rule 4: aspect between Asc sign lords, fixed 7deg orb
// ---------------------------------------------------------------------------

describe('rule4Score (Asc sign lords\' aspect, orb-gated)', () => {
  it('scores 50 for an exact conjunction', () => {
    expect(rule4Score(10, 10, 7)).toBe(50);
  });

  it('scores 50 for a conjunction within the orb', () => {
    expect(rule4Score(10, 15, 7)).toBe(50);
  });

  it('scores 0 for a conjunction just outside the orb', () => {
    expect(rule4Score(10, 17.01, 7)).toBe(0);
  });

  it('scores 50 for an exact trine (120deg)', () => {
    expect(rule4Score(10, 130, 7)).toBe(50);
  });

  it('scores 50 for an exact sextile (60deg)', () => {
    expect(rule4Score(10, 70, 7)).toBe(50);
  });

  it('scores 0 for an exact square (90deg, unfavourable)', () => {
    expect(rule4Score(10, 100, 7)).toBe(0);
  });

  it('scores 0 for an exact opposition (180deg, unfavourable)', () => {
    expect(rule4Score(10, 190, 7)).toBe(0);
  });

  it('wraps across the 0/360 seam', () => {
    expect(rule4Score(358, 2, 7)).toBe(50); // separation 4deg, inside orb of conjunction
  });
});

// ---------------------------------------------------------------------------
// Rule 6: benefic houses
// ---------------------------------------------------------------------------

describe('isBeneficHouse', () => {
  it('2, 3, 5, 7, 9 and 11 are benefic', () => {
    for (const h of [2, 3, 5, 7, 9, 11]) expect(isBeneficHouse(h)).toBe(true);
  });

  it('1, 4, 6, 8, 10 and 12 are not benefic', () => {
    for (const h of [1, 4, 6, 8, 10, 12]) expect(isBeneficHouse(h)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Rules 7 and 10: lord membership
// ---------------------------------------------------------------------------

describe('lordScore (rules 7 and 10: membership in the ruling-planet list)', () => {
  it('scores 50/3 per matching lord, up to 50 for three matches of one call (two calls, one per direction, give the rule its 100)', () => {
    expect(lordScore(['Sun', 'Moon', 'Mars'], ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter'])).toBeCloseTo(50, 10);
  });

  it('scores 0 when none of the lords are in the ruling-planet list', () => {
    expect(lordScore(['Venus', 'Saturn', 'Rahu'], ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter'])).toBe(0);
  });

  it('counts duplicate lords once per occurrence (as KP-Qt\'s loop does)', () => {
    expect(lordScore(['Sun', 'Sun', 'Moon'], ['Sun', 'Moon'])).toBeCloseTo((50 / 3) * 3, 10);
  });
});

// ---------------------------------------------------------------------------
// Rule 8: significator overlap
// ---------------------------------------------------------------------------

describe('significatorScore (rule 8: ruling-planet / house-significator overlap)', () => {
  it('scores 50/3 when at least one ruling planet significates the house', () => {
    expect(significatorScore(['Sun', 'Moon'], ['Moon', 'Mars'])).toBeCloseTo(50 / 3, 10);
  });

  it('scores 0 when no ruling planet significates the house', () => {
    expect(significatorScore(['Sun', 'Moon'], ['Mars', 'Venus'])).toBe(0);
  });

  it('scores 50/3, not more, even when several ruling planets significate (it is a boolean "any")', () => {
    expect(significatorScore(['Sun', 'Moon'], ['Sun', 'Moon', 'Mars'])).toBeCloseTo(50 / 3, 10);
  });
});

// ---------------------------------------------------------------------------
// Rule 10's dasha lookup: synthetic timeline
// ---------------------------------------------------------------------------

function period(lord: DashaPeriod['lord'], level: DashaPeriod['level'], startDate: string, endDate: string, subPeriods?: DashaPeriod[]): DashaPeriod {
  return { lord, level, startDate, endDate, durationDays: 0, subPeriods };
}

const SYNTHETIC_TIMELINE: DashaPeriod[] = [
  period('Sun', 'dasha', '1980-01-01', '1986-01-01', [
    period('Moon', 'bhukti', '1980-01-01', '1982-01-01', [
      period('Mars', 'antara', '1980-01-01', '1981-01-01'),
      period('Mercury', 'antara', '1981-01-01', '1982-01-01'),
    ]),
    period('Mars', 'bhukti', '1982-01-01', '1986-01-01', [period('Jupiter', 'antara', '1982-01-01', '1986-01-01')]),
  ]),
  period('Moon', 'dasha', '1986-01-01', '1996-01-01', [
    period('Saturn', 'bhukti', '1986-01-01', '1996-01-01', [period('Rahu', 'antara', '1986-01-01', '1996-01-01')]),
  ]),
];

describe('dashaLordsAt (rule 10 lookup)', () => {
  it('finds the containing dasha, bhukti and antara', () => {
    const r = dashaLordsAt(SYNTHETIC_TIMELINE, new Date('1981-06-01T00:00:00Z'));
    expect(r).toEqual({ dasha: 'Sun', bhukti: 'Moon', antara: 'Mercury' });
  });

  it('is inclusive of a period\'s start instant', () => {
    const r = dashaLordsAt(SYNTHETIC_TIMELINE, new Date('1986-01-01T00:00:00Z'));
    expect(r).toEqual({ dasha: 'Moon', bhukti: 'Saturn', antara: 'Rahu' });
  });

  it('throws MatchingDateOutOfRangeError before the first dasha', () => {
    expect(() => dashaLordsAt(SYNTHETIC_TIMELINE, new Date('1979-01-01T00:00:00Z'))).toThrow(MatchingDateOutOfRangeError);
  });

  it('throws MatchingDateOutOfRangeError after the last dasha', () => {
    expect(() => dashaLordsAt(SYNTHETIC_TIMELINE, new Date('1996-01-01T00:00:00Z'))).toThrow(MatchingDateOutOfRangeError);
  });

  it('throws MatchingDateOutOfRangeError when a dasha is found but no bhukti covers the instant', () => {
    const gappy: DashaPeriod[] = [period('Sun', 'dasha', '1980-01-01', '1990-01-01', [period('Moon', 'bhukti', '1980-01-01', '1981-01-01')])];
    expect(() => dashaLordsAt(gappy, new Date('1985-01-01T00:00:00Z'))).toThrow(MatchingDateOutOfRangeError);
  });
});

// ---------------------------------------------------------------------------
// localNoonUtc
// ---------------------------------------------------------------------------

describe('localNoonUtc', () => {
  it('converts local noon at +8 to 04:00 UTC', () => {
    expect(localNoonUtc(1986, 2, 1, 8).toISOString()).toBe('1986-02-01T04:00:00.000Z');
  });

  it('converts local noon at -5 to 17:00 UTC', () => {
    expect(localNoonUtc(2000, 6, 15, -5).toISOString()).toBe('2000-06-15T17:00:00.000Z');
  });
});

// ---------------------------------------------------------------------------
// End-to-end fixture: Kiran Raj / Chandra Pravina (KP-Qt's referenceCharts()).
//
// Expected marks were hand-derived from THIS engine's own `calculateChart` output (ayanamsa
// 'kp_new', nodeAgentRuleSet 'none', rulingPlanetSet 'asc_star_sign_moon_star_sign_day_lord'),
// NOT copied from KP-Qt's computed marks (owner, 2026-11-22: KP-Qt's RC1-RC5 have baseline bugs).
// Checking date 1986-02-01 was picked because it sits deep inside non-boundary dasha/bhukti/antara
// periods for both charts (verified against the dumped `dashaTimeline`, no boundary case to assert).
// ---------------------------------------------------------------------------

const options: ChartCalculationOptions = {
  ayanamsa: 'kp_new',
  nodeAgentRuleSet: 'none',
  rulingPlanetSet: 'asc_star_sign_moon_star_sign_day_lord',
};

const BOY_INPUT: DateTimeLocation = {
  year: 1980,
  month: 9,
  day: 14,
  hour: 1,
  minute: 5,
  second: 0,
  utcOffsetHours: 8,
  latitude: 5 + 25 / 60,
  longitude: 100 + 19 / 60,
};

const GIRL_INPUT: DateTimeLocation = {
  year: 1983,
  month: 5,
  day: 31,
  hour: 17,
  minute: 35,
  second: 0,
  utcOffsetHours: 8,
  latitude: 3 + 29 / 60,
  longitude: 102 + 21 / 60,
};

const FIXTURE_CHECKING = { year: 1986, month: 2, day: 1, utcOffsetHours: 8 };
const CHECKING_DATE_UTC = localNoonUtc(1986, 2, 1, 8);

describe('calculateMatch (Kiran Raj / Chandra Pravina reference charts)', () => {
  const boy = calculateChart(BOY_INPUT, options);
  const girl = calculateChart(GIRL_INPUT, options);
  const result = calculateMatch({
    ...options,
    boy: BOY_INPUT,
    girl: GIRL_INPUT,
    checking: FIXTURE_CHECKING,
    aspectOrbDeg: MATCH_RULE4_ORB_DEG,
  });

  it('returns exactly the seven kept rules, in order, gaps at 2/5/9 visible by omission', () => {
    expect(result.rules.map((r) => r.id)).toEqual([1, 3, 4, 6, 7, 8, 10]);
    for (const r of result.rules) expect(r.maxMarks).toBe(100);
  });

  it('rule 1 (Asc sub-lords): 100', () => {
    expect(result.rules.find((r) => r.id === 1)!.marks).toBeCloseTo(100, 6);
  });

  it('rule 3 (Asc sign elements): 0 (boy Taurus=earth, girl Libra=air; not a compatible pair)', () => {
    expect(result.rules.find((r) => r.id === 3)!.marks).toBe(0);
  });

  it('rule 4 (Asc sign lords\' aspect): 100 (both Ascendants are Venus-ruled, so each direction is a self-conjunction)', () => {
    expect(result.rules.find((r) => r.id === 4)!.marks).toBeCloseTo(100, 6);
  });

  it('rule 6 (Moon star lord\'s house in the other chart): 0', () => {
    expect(result.rules.find((r) => r.id === 6)!.marks).toBe(0);
  });

  it('rule 7 (7th cusp lords vs ruling planets): 250/3 (5 of 6 lord-checks hit)', () => {
    expect(result.rules.find((r) => r.id === 7)!.marks).toBeCloseTo((5 * 50) / 3, 6);
  });

  it('rule 8 (houses 2/7/11 significators vs ruling planets): 250/3 (5 of 6 direction-checks hit)', () => {
    expect(result.rules.find((r) => r.id === 8)!.marks).toBeCloseTo((5 * 50) / 3, 6);
  });

  it('rule 10 (dasha lords at checking date vs ruling planets): 50/3 (1 of 6 lord-checks hit)', () => {
    expect(result.rules.find((r) => r.id === 10)!.marks).toBeCloseTo(50 / 3, 6);
  });

  it('totals and percentage follow the seven marks, out of 700', () => {
    const expectedTotal = 100 + 0 + 100 + 0 + (5 * 50) / 3 + (5 * 50) / 3 + 50 / 3;
    expect(result.total).toBeCloseTo(expectedTotal, 6);
    expect(result.maxTotal).toBe(MAX_TOTAL_MARKS);
    expect(result.totalPercent).toBeCloseTo((expectedTotal / MAX_TOTAL_MARKS) * 100, 6);
  });

  it('forwards both charts\' warnings, boy\'s then girl\'s', () => {
    // None of boy's near_sub_boundary warnings (cusp2, cusp12, Mercury, Venus) or girl's (cusp3, cusp9)
    // touch the fields the rules above actually read (both Ascendants, both 7th cusps, both Moons,
    // the Moon-star-lord house placements, the ruling-planet lists, or the dasha lookup) -- so no
    // boundary-range assertion is needed for this fixture's rule marks, only that the warnings are
    // still carried through unmodified.
    // (matching-core tags each message with whose chart it is; the unprefixed text is the chart's own.)
    expect(result.warnings).toEqual([
      ...boy.warnings.map((w) => ({ ...w, message: `Boy's chart: ${w.message}` })),
      ...girl.warnings.map((w) => ({ ...w, message: `Girl's chart: ${w.message}` })),
    ]);
    expect(result.warnings.length).toBe(boy.warnings.length + girl.warnings.length);
  });

  it('echoes each person\'s Asc/7th lords, Moon star lord, day lord and dasha lords at the checking date', () => {
    expect(result.boy.ascendant.signLord).toBe(boy.cusps[0].signLord);
    expect(result.boy.seventhCuspSub.signLord).toBe(boy.cusps[6].signLord);
    expect(result.boy.moonStarLord).toBe(boy.planetPositions.find((p) => p.name === 'Moon')!.starLord);
    expect(result.boy.dayLord).toBe(boy.rulingPlanets.dayLord);
    expect(result.girl.dashaLordsAtChecking).toEqual(dashaLordsAt(girl.dashaBalance.dashaTimeline, CHECKING_DATE_UTC));
  });

  it('throws MatchingDateOutOfRangeError for a checking date before birth', () => {
    expect(() =>
      calculateMatch({ ...options, boy: BOY_INPUT, girl: GIRL_INPUT, checking: { year: 1900, month: 1, day: 1, utcOffsetHours: 8 }, aspectOrbDeg: 7 })
    ).toThrow(MatchingDateOutOfRangeError);
  });
});


// ---------------------------------------------------------------------------
// From matching-core: calculateMatch's structure, per-rule inputs and validation.
// KP-Qt `referenceCharts()` with explicit +8 offsets (this engine does no lat/lon-to-zone lookup).
// ---------------------------------------------------------------------------

const OPTIONS: ChartCalculationOptions = {
  ayanamsa: 'kp_new',
  nodeAgentRuleSet: 'sign_lord_star_lord_same_sign',
  rulingPlanetSet: 'asc_star_sign_moon_star_sign_day_lord',
};

// KP-Qt `referenceCharts()`: Kiran Raj (boy) and Chandra Pravina (girl). KP-Qt leaves the zone
// empty (nearest IANA principal location); this engine takes an explicit offset instead (+8,
// Malaysia, for both birth dates).
const BOY: DateTimeLocation = {
  year: 1980,
  month: 9,
  day: 14,
  hour: 1,
  minute: 5,
  second: 0,
  utcOffsetHours: 8,
  latitude: 5 + 25 / 60,
  longitude: 100 + 19 / 60,
};

const GIRL: DateTimeLocation = {
  year: 1983,
  month: 5,
  day: 31,
  hour: 17,
  minute: 35,
  second: 0,
  utcOffsetHours: 8,
  latitude: 3 + 29 / 60,
  longitude: 102 + 21 / 60,
};

// Checking date: not part of KP-Qt's referenceCharts() (it is a parameter to `match()`). Chosen
// well after both births, with the girl's own birth offset.
const CHECKING = { year: 2026, month: 11, day: 22, utcOffsetHours: 8 };

const INPUT: MatchInput = {
  ...OPTIONS,
  boy: BOY,
  girl: GIRL,
  checking: CHECKING,
  aspectOrbDeg: 7,
};

/** Same convention `matching.ts` uses internally: civil clock time minus the UTC offset. */
function toUtcInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  utcOffsetHours: number
): Date {
  const dayStart = new Date(0);
  dayStart.setUTCFullYear(year, month - 1, day);
  dayStart.setUTCHours(0, 0, 0, 0);
  const localMs = ((hour * 60 + minute) * 60 + second) * 1000;
  return new Date(Math.round(dayStart.getTime() + localMs - utcOffsetHours * 3_600_000));
}

/** Independent re-implementation of `activePeriod`/`dashaLordsAt`, to check `matching.ts` against. */
function activePeriodIndependent(periods: DashaPeriod[], atUtc: Date): DashaPeriod {
  for (let i = 0; i < periods.length; i++) {
    const isLast = i === periods.length - 1;
    const nextStart = isLast ? null : new Date(`${periods[i + 1].startDate}T00:00:00Z`);
    if (isLast || atUtc < nextStart!) return periods[i];
  }
  return periods[periods.length - 1];
}

function dashaLordsAtIndependent(
  moonSiderealLon: number,
  birthUtc: Date,
  atUtc: Date
): { dasha: KPPlanetLord; bhukti: KPPlanetLord; antara: KPPlanetLord } {
  let numDashas = 9;
  let balance = calculateVimshottariDasha(moonSiderealLon, birthUtc, { numDashas });
  for (let guard = 0; guard < 100; guard++) {
    const last = balance.dashaTimeline[balance.dashaTimeline.length - 1];
    if (atUtc <= new Date(`${last.endDate}T00:00:00Z`)) break;
    numDashas += 9;
    balance = calculateVimshottariDasha(moonSiderealLon, birthUtc, { numDashas });
  }
  const dasha = activePeriodIndependent(balance.dashaTimeline, atUtc);
  const bhukti = activePeriodIndependent(dasha.subPeriods ?? [], atUtc);
  const antara = activePeriodIndependent(bhukti.subPeriods ?? [], atUtc);
  return { dasha: dasha.lord, bhukti: bhukti.lord, antara: antara.lord };
}

/** `marks` is 0, 100, or a documented partial value: a multiple of 50/3 from 0 to 100. */
function isDocumentedMarks(marks: number): boolean {
  if (marks === 0 || marks === 50 || marks === 100) return true;
  for (let k = 0; k <= 6; k++) {
    if (Math.abs(marks - (k * 50) / 3) < 1e-9) return true;
  }
  return false;
}

describe('calculateMatch: structure', () => {
  const result = calculateMatch(INPUT);

  it('keeps exactly rules 1, 3, 4, 6, 7, 8, 10 (2, 5 and 9 omitted)', () => {
    expect(result.rules.map((r) => r.id)).toEqual([1, 3, 4, 6, 7, 8, 10]);
  });

  it('every rule is worth 100 and marks are 0, 100, or a documented partial value', () => {
    for (const rule of result.rules) {
      expect(isDocumentedMarks(rule.marks)).toBe(true);
      expect(rule.marks).toBeGreaterThanOrEqual(0);
      expect(rule.marks).toBeLessThanOrEqual(100);
    }
  });

  it('total is the sum of the rules, and maxTotal is 700', () => {
    const sum = result.rules.reduce((s, r) => s + r.marks, 0);
    expect(result.total).toBeCloseTo(sum, 9);
    expect(result.maxTotal).toBe(700);
    expect(result.totalPercent).toBeCloseTo((result.total / 700) * 100, 9);
  });

  it('omitting ayanamsa throws', () => {
    const bad = { ...INPUT, ayanamsa: undefined } as unknown as MatchInput;
    expect(() => calculateMatch(bad)).toThrow();
  });

  it('rejects an aspectOrbDeg outside 0..30', () => {
    expect(() => calculateMatch({ ...INPUT, aspectOrbDeg: -1 })).toThrow(RangeError);
    expect(() => calculateMatch({ ...INPUT, aspectOrbDeg: 31 })).toThrow(RangeError);
  });
});

describe('calculateMatch: per-rule inputs, checked independently', () => {
  const result = calculateMatch(INPUT);
  const boyChart = calculateChart(BOY, OPTIONS);
  const girlChart = calculateChart(GIRL, OPTIONS);

  it("rule 1's input: each chart's Ascendant sub lord matches calculateChart's own cusp", () => {
    expect(result.boy.ascendant.subLord).toBe(boyChart.cusps[0].subLord);
    expect(result.girl.ascendant.subLord).toBe(girlChart.cusps[0].subLord);
    expect(result.boy.ascendant.signLord).toBe(boyChart.cusps[0].signLord);
    expect(result.boy.ascendant.starLord).toBe(boyChart.cusps[0].starLord);
  });

  it("rule 7's input: each chart's 7th cusp lords match calculateChart's own cusp", () => {
    expect(result.boy.seventhCuspSub).toEqual({
      signLord: boyChart.cusps[6].signLord,
      starLord: boyChart.cusps[6].starLord,
      subLord: boyChart.cusps[6].subLord,
    });
    expect(result.girl.seventhCuspSub).toEqual({
      signLord: girlChart.cusps[6].signLord,
      starLord: girlChart.cusps[6].starLord,
      subLord: girlChart.cusps[6].subLord,
    });
  });

  it("rule 6's input: each chart's Moon star lord matches calculateChart's own Moon", () => {
    const boyMoon = boyChart.planetPositions.find((p) => p.name === 'Moon')!;
    const girlMoon = girlChart.planetPositions.find((p) => p.name === 'Moon')!;
    expect(result.boy.moonStarLord).toBe(boyMoon.starLord);
    expect(result.girl.moonStarLord).toBe(girlMoon.starLord);
  });

  it("rules 7, 8 and 10's input: each chart's day lord and ruling-planet list match calculateChart's own", () => {
    expect(result.boy.dayLord).toBe(boyChart.rulingPlanets.dayLord);
    expect(result.girl.dayLord).toBe(girlChart.rulingPlanets.dayLord);
    expect(result.boy.rulingPlanetsList).toEqual(boyChart.rulingPlanets.rulingPlanetsList);
    expect(result.girl.rulingPlanetsList).toEqual(girlChart.rulingPlanets.rulingPlanetsList);
  });

  it("rule 10's input: each chart's dasha/bhukti/antara lord at the checking date matches an independent walk of calculateVimshottariDasha's timeline", () => {
    const checkingUtc = toUtcInstant(
      CHECKING.year,
      CHECKING.month,
      CHECKING.day,
      12,
      0,
      0,
      CHECKING.utcOffsetHours
    );
    const boyMoon = boyChart.planetPositions.find((p) => p.name === 'Moon')!;
    const girlMoon = girlChart.planetPositions.find((p) => p.name === 'Moon')!;
    const boyBirthUtc = toUtcInstant(
      BOY.year,
      BOY.month,
      BOY.day,
      BOY.hour,
      BOY.minute,
      BOY.second,
      BOY.utcOffsetHours!
    );
    const girlBirthUtc = toUtcInstant(
      GIRL.year,
      GIRL.month,
      GIRL.day,
      GIRL.hour,
      GIRL.minute,
      GIRL.second,
      GIRL.utcOffsetHours!
    );
    const expectedBoyDasha = dashaLordsAtIndependent(boyMoon.siderealLongitude, boyBirthUtc, checkingUtc);
    const expectedGirlDasha = dashaLordsAtIndependent(girlMoon.siderealLongitude, girlBirthUtc, checkingUtc);

    expect(result.boy.dashaLordsAtChecking).toEqual(expectedBoyDasha);
    expect(result.girl.dashaLordsAtChecking).toEqual(expectedGirlDasha);
  });
});

describe('calculateMatch: warnings', () => {
  it('carries forward any chart warnings from either chart, tagged by whose chart it is', () => {
    const result = calculateMatch(INPUT);
    for (const w of result.warnings) {
      expect(w.message.startsWith("Boy's chart: ") || w.message.startsWith("Girl's chart: ")).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Where the two branches differed (work package `horoscope-matching`): each difference is pinned.
// ---------------------------------------------------------------------------

describe('merged behaviour: rule 4 orb', () => {
  const person = (year: number, day: number, hour: number): DateTimeLocation => ({
    year, month: 3, day, hour, minute: 0, second: 0, utcOffsetHours: 8, latitude: 3.1, longitude: 101.7,
  });
  const pair = { boy: person(1990, 1, 3), girl: person(1992, 14, 15) };
  const base = { ...OPTIONS, ...pair, checking: { year: 2026, month: 11, day: 22, utcOffsetHours: 8 } };
  const rule4 = (orb: number) => calculateMatch({ ...base, aspectOrbDeg: orb }).rules.find((r) => r.id === 4)!.marks;

  it('the engine takes the orb as an input (matching-core) and it changes rule 4: 0 at an orb of 0, 50 at 7', () => {
    expect(rule4(0)).toBe(0);
    expect(rule4(MATCH_RULE4_ORB_DEG)).toBe(50);
  });

  it('MATCH_RULE4_ORB_DEG is Kuppu\'s 7 degrees (KP-Qt kKuppuOrbDeg); the owner has not confirmed it', () => {
    expect(MATCH_RULE4_ORB_DEG).toBe(7);
  });

  it('a missing or non-numeric orb throws instead of defaulting to 7', () => {
    expect(() => calculateMatch({ ...base } as unknown as MatchInput)).toThrow(RangeError);
    expect(() => calculateMatch({ ...base, aspectOrbDeg: Number.NaN })).toThrow(RangeError);
  });
});

describe('merged behaviour: rule 10 checking date', () => {
  const boyChart = calculateChart(BOY, OPTIONS);
  const boyMoon = boyChart.planetPositions.find((p) => p.name === 'Moon')!;

  it('a date past the first 120-year cycle is answered from an extended timeline (matching-core), not an error (horoscope-match)', () => {
    const checking = { year: 2125, month: 6, day: 1, utcOffsetHours: 8 };
    const r = calculateMatch({ ...INPUT, checking });
    const checkingUtc = toUtcInstant(2125, 6, 1, 12, 0, 0, 8);
    const boyBirthUtc = toUtcInstant(BOY.year, BOY.month, BOY.day, BOY.hour, BOY.minute, BOY.second, BOY.utcOffsetHours!);
    expect(r.boy.dashaLordsAtChecking).toEqual(dashaLordsAtIndependent(boyMoon.siderealLongitude, boyBirthUtc, checkingUtc));
    // The chart's own 9-dasha timeline ends before it.
    const own = boyChart.dashaBalance.dashaTimeline;
    expect(() => dashaLordsAt(own, checkingUtc)).toThrow(MatchingDateOutOfRangeError);
  });

  it('a date before the first period throws (horoscope-match); matching-core clamped it silently to the first period', () => {
    expect(() => calculateMatch({ ...INPUT, checking: { year: 1900, month: 1, day: 1, utcOffsetHours: 8 } })).toThrow(
      MatchingDateOutOfRangeError
    );
  });

  it('the timeline has no gap: every day from birth to the end of the chart\'s own timeline has a dasha, bhukti and antara', () => {
    const timeline = boyChart.dashaBalance.dashaTimeline;
    const start = Date.parse(`${timeline[0].startDate}T00:00:00Z`);
    const end = Date.parse(`${timeline[timeline.length - 1].endDate}T00:00:00Z`);
    for (let t = start; t < end; t += 86_400_000) {
      expect(() => dashaLordsAt(timeline, new Date(t + 12 * 3_600_000))).not.toThrow();
    }
  });

  it('a boundary date belongs to the period that starts on it (start inclusive, end exclusive)', () => {
    const timeline = boyChart.dashaBalance.dashaTimeline;
    const second = timeline[1];
    const at = new Date(`${second.startDate}T00:00:00Z`);
    expect(dashaLordsAt(timeline, at).dasha).toBe(second.lord);
    expect(dashaLordsAt(timeline, new Date(at.getTime() - 1)).dasha).toBe(timeline[0].lord);
  });
});

describe('merged behaviour: the checking instant', () => {
  it('is noon civil time in the offset given, to the millisecond (an offset kept to the second does not drift)', () => {
    expect(localNoonUtc(2026, 11, 22, 5.5).toISOString()).toBe('2026-11-22T06:30:00.000Z');
    // UTC+7:20:00 (an LMT-style offset to the second): 12:00 - 7:20 = 04:40:00.000Z exactly.
    expect(localNoonUtc(1900, 1, 1, 7 + 20 / 60).toISOString()).toBe('1900-01-01T04:40:00.000Z');
    expect(localNoonUtc(1900, 1, 1, 26_400 / 3600).toISOString()).toBe('1900-01-01T04:40:00.000Z');
  });

  it('calculateMatch reports the instant it used', () => {
    const r = calculateMatch({ ...INPUT, checking: { year: 2026, month: 7, day: 1, utcOffsetHours: 1 } });
    expect(r.checkingUtc).toBe('2026-07-01T11:00:00.000Z');
  });

  it('a person without utcOffsetHours is refused, never treated as UTC', () => {
    const noOffset = { ...BOY, utcOffsetHours: undefined };
    expect(() => calculateMatch({ ...INPUT, boy: noOffset })).toThrow(RangeError);
  });
});

describe('merged behaviour: every rule row says what it is worth', () => {
  it('maxMarks is 100 for each of the seven rules and sums to maxTotal', () => {
    const r = calculateMatch(INPUT);
    for (const rule of r.rules) expect(rule.maxMarks).toBe(100);
    expect(r.rules.reduce((s, x) => s + x.maxMarks, 0)).toBe(r.maxTotal);
    expect(r.maxTotal).toBe(MAX_TOTAL_MARKS);
  });
});

