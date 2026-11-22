/**
 * Horoscope Matching: the KP Dasavidha Porutham rules (work package `horoscope-matching`, #100).
 *
 * Ported from KP-Qt's `src/horomatch.{h,cpp}` (vgnshlvnz/KP-Qt @83264c6). Source named by that
 * file's own header comment: K. P. Kuppu Ganapathi, "KP Dasavidha Porutham", K.P. & Astrology Year
 * Book 1997, pp. 32-44. This file does not reproduce the article.
 *
 * This is the combination of two earlier branches (`matching-core`: `calculateMatch(input)` and the
 * types; `horoscope-match`: one exported pure scoring function per rule and `POST /api/match`).
 *
 * Owner decisions for this port (2026-11-22):
 * - Rules 2 ("HARMONY IN MARRIED LIFE"), 5 ("MUTUAL UNDERSTANDING BETWEEN THE COUPLES") and 9
 *   ("SMOOTHNESS IN MARRIED LIFE") are OMITTED entirely, not scored as null rows. KP-Qt's own
 *   header documents them as unverified: the friendship table used for rule 2 includes a fitted,
 *   non-BPHS override; rule 5's "unfavourable aspect" class list is not in the article; rule 9's
 *   sub-lord "connected" test is a guess. None of that logic is ported, and neither is
 *   `Reading::ReferenceFitted` (KP-Qt's fit to one screenshot): this is the "Sourced" reading only.
 * - Rules 1, 3, 4, 6, 7, 8 and 10 are kept, each worth 100 marks: `maxTotal` is 700 and
 *   `totalPercent` is of 700. Rule numbers and titles are KP-Qt's (`kDesc`), so the gaps at 2, 5
 *   and 9 stay visible.
 * - Rule 1 still needs the BPHS friendship table (with KP-Qt's Rahu/Ketu substitution); see
 *   `BPHS_TABLE` below.
 * - Dasha lords use this engine's own `calculateVimshottariDasha` (`DASHA_YEAR_DAYS`, 365.2425,
 *   #29 owner 2026-11-21), not KP-Qt's 365.25.
 *
 * Open for the owner: rule 4's orb. `calculateMatch` takes it as a required input
 * (`MatchInput.aspectOrbDeg`); the API passes `MATCH_RULE4_ORB_DEG` (`conventions.ts`, 7 degrees,
 * Kuppu's value in KP-Qt, TO BE CONFIRMED by the owner).
 *
 * Time: the engine takes every UTC offset explicitly (both births and the checking date). It does
 * no latitude/longitude-to-zone lookup. `POST /api/match` resolves a `locationId` to an offset
 * with `src/core/locations.ts` and `computeTimezoneOffset`.
 */

import { calculateChart } from './index.js';
import { calculateVimshottariDasha } from './dasha.js';
import type {
  ChartCalculationOptions,
  ChartWarning,
  DashaPeriod,
  FullChartCalculationResult,
  KPPlanetLord,
  MatchChartKeyLords,
  MatchInput,
  MatchResult,
  MatchRuleResult,
} from './types.js';

/** Seven rules kept, 100 marks each (KP-Qt's ten rules less 2, 5 and 9). */
export const MAX_TOTAL_MARKS = 700;

/** Marks one kept rule is worth. */
export const MARKS_PER_RULE = 100;

/** Rule titles (KP-Qt `kDesc`, `horomatch.cpp`). Rules 2, 5, 9 omitted (owner, 2026-11-22). */
const RULE_TITLES: Readonly<Record<number, string>> = {
  1: 'CHARACTERISTICS COMPATIBILITY',
  3: 'ATTITUDES AND URGES',
  4: 'GENERAL HAPPINESS',
  6: 'PLEASURE AND HAPPINESS AFTER MARRIAGE',
  7: 'GENERAL SUITABILITY FOR MARRIAGE',
  8: 'LIKELIHOOD OF MARRIAGE WITH THIS BOY AND THE GIRL',
  10: 'WHETHER THE PERIOD LORDS NOW OPERATING IN BOTH CHARTS INDICATE DESIRABILITY OF MATCHING FOR MARRIAGE',
};

/** `checking` falls outside the computed dasha timeline of a chart. */
export class MatchingDateOutOfRangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MatchingDateOutOfRangeError';
  }
}

// ---------------------------------------------------------------------------
// Rule 1: Asc sub lords, BPHS 3.55 natural friendship
// ---------------------------------------------------------------------------

const FRIEND = 0;
const NEUTRAL = 1;
const ENEMY = 2;

/** Row/column order of `BPHS_TABLE`. */
const BPHS_ORDER: readonly KPPlanetLord[] = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];

/**
 * BPHS 3.55 natural planetary friendship, row regards column: 0 friend, 1 neutral, 2 enemy.
 * Reproduced from KP-Qt's `horomatch.cpp` (`kBphs`); KP-Qt's header cites Kuppu Ganapathi's article
 * for the rule itself, not this table.
 */
const BPHS_TABLE: readonly (readonly number[])[] = [
  /* Sun     */ [FRIEND, FRIEND, FRIEND, NEUTRAL, FRIEND, ENEMY, ENEMY],
  /* Moon    */ [FRIEND, FRIEND, NEUTRAL, FRIEND, NEUTRAL, NEUTRAL, NEUTRAL],
  /* Mars    */ [FRIEND, FRIEND, FRIEND, ENEMY, FRIEND, NEUTRAL, NEUTRAL],
  /* Mercury */ [FRIEND, ENEMY, NEUTRAL, FRIEND, NEUTRAL, FRIEND, NEUTRAL],
  /* Jupiter */ [FRIEND, FRIEND, FRIEND, ENEMY, FRIEND, ENEMY, NEUTRAL],
  /* Venus   */ [ENEMY, ENEMY, NEUTRAL, FRIEND, NEUTRAL, FRIEND, FRIEND],
  /* Saturn  */ [ENEMY, ENEMY, ENEMY, FRIEND, NEUTRAL, FRIEND, FRIEND],
];

/**
 * BPHS has no rows for the lunar nodes. KP-Qt's substitution (`horomatch.cpp`, `regard`): Rahu
 * takes Saturn's row and column, Ketu takes Mars's. Kept only because rule 1 (a kept, sourced
 * rule) depends on it.
 */
function bphsRow(lord: KPPlanetLord): KPPlanetLord {
  if (lord === 'Rahu') return 'Saturn';
  if (lord === 'Ketu') return 'Mars';
  return lord;
}

/** How `a` regards `b` in natural friendship: 0 friend, 1 neutral, 2 enemy (not symmetric). */
export function regards(a: KPPlanetLord, b: KPPlanetLord): number {
  if (a === b) return FRIEND;
  const ra = bphsRow(a);
  const rb = bphsRow(b);
  if (ra === rb) return FRIEND;
  return BPHS_TABLE[BPHS_ORDER.indexOf(ra)][BPHS_ORDER.indexOf(rb)];
}

/**
 * Rule 1 (KP-Qt `directionPair`): `total` split 50/50 across the two directions. A direction
 * scores unless the first planet regards the second as an enemy.
 */
export function directionPair(a: KPPlanetLord, b: KPPlanetLord, total: number): number {
  let s = 0;
  if (regards(a, b) !== ENEMY) s += total / 2;
  if (regards(b, a) !== ENEMY) s += total / 2;
  return s;
}

// ---------------------------------------------------------------------------
// Rule 3: Asc sign elements
// ---------------------------------------------------------------------------

/** Fire=0, earth=1, air=2, water=3 from Aries, repeating (KP-Qt `kEl`). */
function elementOf(signIndex: number): number {
  return signIndex % 4;
}

/**
 * Kuppu's compatible element pairs, unordered (KP-Qt `elementsCompatible`): fire-fire,
 * water-water, fire-air, earth-water, air-water. Air-air and earth-earth are not in the list.
 */
function elementsCompatible(signIndexA: number, signIndexB: number): boolean {
  let a = elementOf(signIndexA);
  let b = elementOf(signIndexB);
  if (a > b) [a, b] = [b, a];
  return (a === 0 && b === 0) || (a === 3 && b === 3) || (a === 0 && b === 2) || (a === 1 && b === 3) || (a === 2 && b === 3);
}

/** Rule 3: 100 if the two Ascendant signs' elements are compatible, else 0. Signs are 0 (Aries) to 11. */
export function rule3Score(signIndexA: number, signIndexB: number): number {
  return elementsCompatible(signIndexA, signIndexB) ? MARKS_PER_RULE : 0;
}

// ---------------------------------------------------------------------------
// Rule 4: aspect between the Asc sign lords
// ---------------------------------------------------------------------------

function normalize360(x: number): number {
  const r = x % 360;
  return r < 0 ? r + 360 : r;
}

function angularSeparation(a: number, b: number): number {
  const d = Math.abs(normalize360(a) - normalize360(b));
  return d > 180 ? 360 - d : d;
}

const ASPECT_ANGLES = [0, 60, 90, 120, 180] as const;
const ASPECT_FAVOURABLE = [true, true, false, true, false] as const;

/**
 * Rule 4, one chart (KP-Qt `rule4Chart`): major aspects only, the closest one inside the orb wins.
 * Favourable (conjunction, sextile, trine) scores 50; square, opposition, or no aspect inside the
 * orb scores 0. The orb is a parameter here; the engine takes it as `MatchInput.aspectOrbDeg`.
 */
export function rule4Score(lonA: number, lonB: number, orbDeg: number): number {
  const d = angularSeparation(lonA, lonB);
  let best = -1;
  let bestOrb = Infinity;
  for (let i = 0; i < ASPECT_ANGLES.length; i++) {
    const o = Math.abs(d - ASPECT_ANGLES[i]);
    if (o <= orbDeg + 1e-9 && o < bestOrb) {
      bestOrb = o;
      best = i;
    }
  }
  if (best < 0 || !ASPECT_FAVOURABLE[best]) return 0;
  return 50;
}

// ---------------------------------------------------------------------------
// Rule 6: Moon star lord's house in the other chart
// ---------------------------------------------------------------------------

/** Rule 6's favourable houses (KP-Qt `goodHouse`): 2, 3, 5, 7, 9, 11. */
const BENEFIC_HOUSES = new Set([2, 3, 5, 7, 9, 11]);

export function isBeneficHouse(house: number): boolean {
  return BENEFIC_HOUSES.has(house);
}

function planetOf(chart: FullChartCalculationResult, lord: KPPlanetLord) {
  const planet = chart.planetPositions.find((p) => p.name === lord);
  if (!planet) throw new Error(`Chart has no planet position for ${lord}`); // cannot happen: all 9 KP bodies are always computed
  return planet;
}

// ---------------------------------------------------------------------------
// Rules 7, 8 and 10: membership in the other chart's ruling planets
// ---------------------------------------------------------------------------

const MEMBERSHIP_UNIT = 50 / 3;

/** Rules 7 and 10, one direction: 50/3 for each of `lords` that is in `rulingPlanets` (50 for all three). */
export function lordScore(lords: readonly KPPlanetLord[], rulingPlanets: readonly KPPlanetLord[]): number {
  let score = 0;
  for (const lord of lords) {
    if (rulingPlanets.includes(lord)) score += MEMBERSHIP_UNIT;
  }
  return score;
}

/** Rule 8, one house and one direction: 50/3 if any of `rulingPlanets` significates that house. */
export function significatorScore(rulingPlanets: readonly KPPlanetLord[], houseSignificators: readonly string[]): number {
  return rulingPlanets.some((p) => houseSignificators.includes(p)) ? MEMBERSHIP_UNIT : 0;
}

// ---------------------------------------------------------------------------
// Rule 10: dasha lords at the checking instant
// ---------------------------------------------------------------------------

export interface DashaLordsAtChecking {
  dasha: KPPlanetLord;
  bhukti: KPPlanetLord;
  antara: KPPlanetLord;
}

function containingPeriod(periods: readonly DashaPeriod[], whenMs: number): DashaPeriod | null {
  for (const p of periods) {
    const start = Date.parse(`${p.startDate}T00:00:00Z`);
    const end = Date.parse(`${p.endDate}T00:00:00Z`);
    if (whenMs >= start && whenMs < end) return p;
  }
  return null;
}

/**
 * Dasha, bhukti and antara lord active at `whenUtc` in an already-computed `dashaTimeline`
 * (KP-Qt `dashaAt`, levels 0 to 2). A period contains its start date and not its end date. An
 * instant outside the timeline, or in a gap between sub-periods, is a `MatchingDateOutOfRangeError`:
 * it is never clamped to the first or last period.
 */
export function dashaLordsAt(dashaTimeline: readonly DashaPeriod[], whenUtc: Date): DashaLordsAtChecking {
  const whenMs = whenUtc.getTime();
  const dasha = containingPeriod(dashaTimeline, whenMs);
  if (!dasha) {
    throw new MatchingDateOutOfRangeError(
      `The checking date (${whenUtc.toISOString().slice(0, 10)}) is outside the computed dasha timeline: ` +
        `before its first period, or beyond the last of its ${dashaTimeline.length} major periods.`
    );
  }
  const bhukti = containingPeriod(dasha.subPeriods ?? [], whenMs);
  if (!bhukti) {
    throw new MatchingDateOutOfRangeError(`The checking date falls outside the computed bhukti periods of the ${dasha.lord} dasha.`);
  }
  const antara = containingPeriod(bhukti.subPeriods ?? [], whenMs);
  if (!antara) {
    throw new MatchingDateOutOfRangeError(`The checking date falls outside the computed antara periods of the ${bhukti.lord} bhukti.`);
  }
  return { dasha: dasha.lord, bhukti: bhukti.lord, antara: antara.lord };
}

/**
 * A chart's own timeline (9 dashas from birth, under 120 years), extended by whole Vimshottari
 * cycles until it covers `whenUtc`, so a checking date past the first cycle is still answered.
 * A date before the timeline still fails in `dashaLordsAt`.
 */
function dashaTimelineCovering(
  chart: FullChartCalculationResult,
  moonSiderealLon: number,
  birthUtc: Date,
  whenUtc: Date
): DashaPeriod[] {
  let timeline = chart.dashaBalance.dashaTimeline;
  let numDashas = timeline.length;
  for (let guard = 0; guard < 100; guard++) {
    const last = timeline[timeline.length - 1];
    if (whenUtc.getTime() < Date.parse(`${last.endDate}T00:00:00Z`)) break;
    numDashas += 9;
    timeline = calculateVimshottariDasha(moonSiderealLon, birthUtc, { numDashas }).dashaTimeline;
  }
  return timeline;
}

// ---------------------------------------------------------------------------
// Civil time -> UTC instant
// ---------------------------------------------------------------------------

/**
 * Civil clock time minus the UTC offset, as a UTC instant (the engine's own convention: positive
 * offsets are east of Greenwich). Rounded to the millisecond, because an offset kept to the second
 * is a fraction of an hour.
 */
export function civilToUtc(
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

/**
 * The checking instant: 12:00 civil time on the checking date, in the UTC offset given (KP-Qt:
 * the girl's zone at the checking date, `horomatch.cpp` `match()` around line 656; see
 * `POST /api/match` for how the offset is resolved).
 */
export function localNoonUtc(year: number, month: number, day: number, utcOffsetHours: number): Date {
  return civilToUtc(year, month, day, 12, 0, 0, utcOffsetHours);
}

// ---------------------------------------------------------------------------
// calculateMatch
// ---------------------------------------------------------------------------

function keyLords(chart: FullChartCalculationResult, dasha: DashaLordsAtChecking): MatchChartKeyLords {
  const asc = chart.cusps[0]; // house 1
  const seventh = chart.cusps[6]; // house 7
  return {
    ascendant: { signLord: asc.signLord, starLord: asc.starLord, subLord: asc.subLord },
    seventhCuspSub: { signLord: seventh.signLord, starLord: seventh.starLord, subLord: seventh.subLord },
    moonStarLord: planetOf(chart, 'Moon').starLord,
    dayLord: chart.rulingPlanets.dayLord,
    dashaLordsAtChecking: dasha,
    rulingPlanetsList: chart.rulingPlanets.rulingPlanetsList,
  };
}

/** `allSignificators` of one house (KP-Qt `significators()`: the union of all four levels). */
function houseSignificators(chart: FullChartCalculationResult, house: number): string[] {
  const row = chart.significators.houseWise.find((h) => h.house === house);
  if (!row) throw new Error(`Chart has no significators for house ${house}`); // cannot happen: all 12 houses are always computed
  return row.allSignificators;
}

/**
 * The KP Dasavidha Porutham match for a boy's and a girl's chart, at a checking date. Rules 2, 5
 * and 9 are omitted (see the file header); the kept rules (1, 3, 4, 6, 7, 8, 10) are each worth
 * 100 marks, for `maxTotal` 700.
 *
 * `input.ayanamsa` is required with no default (#22 decided), as are `input.rulingPlanetSet` (#24
 * open) and `input.nodeAgentRuleSet` (#23 open), because `calculateChart` needs all three; this
 * module does not use the Rahu/Ketu agent significators the last one adds. Both births and the
 * checking date need an explicit UTC offset.
 */
export function calculateMatch(input: MatchInput): MatchResult {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('calculateMatch requires an input object');
  }
  if (!Number.isFinite(input.aspectOrbDeg) || input.aspectOrbDeg < 0 || input.aspectOrbDeg > 30) {
    throw new RangeError(`aspectOrbDeg must be between 0 and 30 degrees, got ${input.aspectOrbDeg}`);
  }

  const options: ChartCalculationOptions = {
    ayanamsa: input.ayanamsa,
    nodeAgentRuleSet: input.nodeAgentRuleSet,
    rulingPlanetSet: input.rulingPlanetSet,
  };

  // `calculateChart` refuses a missing offset, so `utcOffsetHours` is defined past these two calls.
  const boy = calculateChart(input.boy, options);
  const girl = calculateChart(input.girl, options);

  const checkingUtc = localNoonUtc(
    input.checking.year,
    input.checking.month,
    input.checking.day,
    input.checking.utcOffsetHours
  );
  const boyMoon = planetOf(boy, 'Moon');
  const girlMoon = planetOf(girl, 'Moon');
  const boyDasha = dashaLordsAt(
    dashaTimelineCovering(boy, boyMoon.siderealLongitude, birthInstant(input.boy), checkingUtc),
    checkingUtc
  );
  const girlDasha = dashaLordsAt(
    dashaTimelineCovering(girl, girlMoon.siderealLongitude, birthInstant(input.girl), checkingUtc),
    checkingUtc
  );

  const boyAsc = boy.cusps[0];
  const girlAsc = girl.cusps[0];
  const boySeventh = boy.cusps[6];
  const girlSeventh = girl.cusps[6];
  const boyRuling = boy.rulingPlanets.rulingPlanetsList;
  const girlRuling = girl.rulingPlanets.rulingPlanetsList;

  // Rule 1: CHARACTERISTICS COMPATIBILITY (Ascendant sub lords, BPHS natural friendship).
  const m1 = directionPair(boyAsc.subLord, girlAsc.subLord, MARKS_PER_RULE);

  // Rule 3: ATTITUDES AND URGES (Ascendant sign elements).
  const m3 = rule3Score(boyAsc.signIndex, girlAsc.signIndex);

  // Rule 4: GENERAL HAPPINESS (aspect between the two Ascendant sign lords, read from each
  // person's OWN ephemeris).
  const m4 =
    rule4Score(planetOf(boy, boyAsc.signLord).siderealLongitude, planetOf(boy, girlAsc.signLord).siderealLongitude, input.aspectOrbDeg) +
    rule4Score(planetOf(girl, boyAsc.signLord).siderealLongitude, planetOf(girl, girlAsc.signLord).siderealLongitude, input.aspectOrbDeg);

  // Rule 6: PLEASURE AND HAPPINESS AFTER MARRIAGE (each one's Moon star lord, by house in the
  // other's chart).
  const m6 =
    (isBeneficHouse(planetOf(girl, boyMoon.starLord).house) ? 50 : 0) +
    (isBeneficHouse(planetOf(boy, girlMoon.starLord).house) ? 50 : 0);

  // Rule 7: GENERAL SUITABILITY FOR MARRIAGE (7th cusp lords against the other's ruling planets).
  const m7 =
    lordScore([boySeventh.signLord, boySeventh.starLord, boySeventh.subLord], girlRuling) +
    lordScore([girlSeventh.signLord, girlSeventh.starLord, girlSeventh.subLord], boyRuling);

  // Rule 8: LIKELIHOOD OF MARRIAGE (one's ruling planets against the other's significators of
  // houses 2, 7, 11).
  let m8 = 0;
  for (const house of [2, 7, 11]) {
    m8 += significatorScore(boyRuling, houseSignificators(girl, house));
    m8 += significatorScore(girlRuling, houseSignificators(boy, house));
  }

  // Rule 10: PERIOD LORDS (each one's dasha/bhukti/antara lord at the checking instant, against
  // the other's ruling planets).
  const m10 =
    lordScore([boyDasha.dasha, boyDasha.bhukti, boyDasha.antara], girlRuling) +
    lordScore([girlDasha.dasha, girlDasha.bhukti, girlDasha.antara], boyRuling);

  const marks: ReadonlyArray<readonly [number, number]> = [
    [1, m1],
    [3, m3],
    [4, m4],
    [6, m6],
    [7, m7],
    [8, m8],
    [10, m10],
  ];
  const rules: MatchRuleResult[] = marks.map(([id, m]) => ({
    id,
    description: RULE_TITLES[id],
    marks: m,
    maxMarks: MARKS_PER_RULE,
  }));
  const total = rules.reduce((sum, r) => sum + r.marks, 0);

  const warnings: ChartWarning[] = [
    ...boy.warnings.map((w) => ({ ...w, message: `Boy's chart: ${w.message}` })),
    ...girl.warnings.map((w) => ({ ...w, message: `Girl's chart: ${w.message}` })),
  ];

  return {
    rules,
    total,
    maxTotal: MAX_TOTAL_MARKS,
    totalPercent: (total / MAX_TOTAL_MARKS) * 100,
    checkingUtc: checkingUtc.toISOString(),
    boy: keyLords(boy, boyDasha),
    girl: keyLords(girl, girlDasha),
    warnings,
  };
}

function birthInstant(p: MatchInput['boy']): Date {
  return civilToUtc(p.year, p.month, p.day, p.hour, p.minute, p.second, p.utcOffsetHours as number);
}
