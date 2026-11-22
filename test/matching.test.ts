/**
 * Horoscope Matching (KP Dasavidha Porutham), work package `matching-core`.
 *
 * Reference charts: KP-Qt's `horomatch.cpp` `referenceCharts()` (lines ~543-564), reproduced here
 * with explicit UTC offsets (this engine does no lat/lon-to-zone lookup; see `types.ts`'s
 * `MatchInput`). The checking date and all offsets below are test fixtures, not a reproduction of
 * KP-Qt's own zone database.
 *
 * What this file does NOT do: assert KP-Qt's printed scores as expected values. The KP-Qt
 * baseline has known lord, dasha and sub errors, and the kp-reference checker is currently down.
 * TODO: once a reference check against kp-reference (or Swiss Ephemeris) is possible, add
 * score-level expectations for the reference pair under the Sourced reading.
 */
import { describe, expect, it } from 'vitest';
import { calculateChart, calculateMatch } from '../src/engine/index.js';
import { calculateVimshottariDasha } from '../src/engine/dasha.js';
import type {
  ChartCalculationOptions,
  DashaPeriod,
  DateTimeLocation,
  KPPlanetLord,
  MatchInput,
} from '../src/engine/types.js';

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
