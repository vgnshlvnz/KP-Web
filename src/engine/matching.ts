/**
 * Horoscope Matching: the KP Dasavidha Porutham rules (work package `matching-core`).
 *
 * Ported from KP-Qt's `src/horomatch.{h,cpp}`. Source named by that file's own header comment:
 * K. P. Kuppu Ganapathi, "KP Dasavidha Porutham", K.P. & Astrology Year Book 1997, pp. 32-44.
 * This file does not reproduce the article.
 *
 * Owner decisions for this port (approved on the matching plan, 2026-11-22):
 * - Rules 2 ("HARMONY IN MARRIED LIFE"), 5 ("MUTUAL UNDERSTANDING BETWEEN THE COUPLES") and 9
 *   ("SMOOTHNESS IN MARRIED LIFE") are omitted entirely. KP-Qt's own header documents them as
 *   unverified: the friendship table used for rule 2 includes a fitted, non-BPHS override; rule
 *   5's "unfavourable aspect" class list is not in the article; rule 9's sub-lord "connected" test
 *   is a guess. None of that logic (friendship-table or otherwise for R2, aspect-class logic for
 *   R5, "connected" logic for R9) is ported here.
 * - Rules 1, 3, 4, 6, 7, 8 and 10 are kept, each worth 100 marks: `maxTotal` is 700, and
 *   `totalPercent` is of 700.
 * - Rule 1 still needs the BPHS friendship table (with KP-Qt's Rahu/Ketu substitution); see
 *   `BPHS_NATURAL_FRIENDSHIP` below.
 * - `Reading::ReferenceFitted` (KP-Qt's fit to one screenshot) is not ported. This is the
 *   "Sourced" reading only.
 * - Rule 4's orb (`aspectOrbDeg`) is a required input, not a constant in `conventions.ts`.
 * - No lat/lon-to-zone lookup: every UTC offset (both births, and the checking date) is supplied
 *   explicitly by the caller, through the existing `DateTimeLocation` pattern.
 */

import {
  calculateChart,
} from './index.js';
import { calculateVimshottariDasha } from './dasha.js';
import type {
  ChartCalculationOptions,
  DateTimeLocation,
  DashaPeriod,
  FullChartCalculationResult,
  KPPlanetLord,
  MatchChartKeyLords,
  MatchInput,
  MatchResult,
  MatchRuleResult,
} from './types.js';

const MAX_TOTAL = 700;

// ---------------------------------------------------------------------------
// BPHS natural friendship (rule 1)
// ---------------------------------------------------------------------------

const FRIEND = 0;
const NEUTRAL = 1;
const ENEMY = 2;

/** Row/column order of `BPHS_NATURAL_FRIENDSHIP`. */
const FRIENDSHIP_ORDER: readonly KPPlanetLord[] = [
  'Sun',
  'Moon',
  'Mars',
  'Mercury',
  'Jupiter',
  'Venus',
  'Saturn',
];

/**
 * BPHS 3.55 natural planetary friendship, row regards column: 0 friend, 1 neutral, 2 enemy.
 * Reproduced from KP-Qt's `horomatch.cpp` (`kBphs`), which is the table rule 1's scoring needs;
 * KP-Qt's header cites Kuppu Ganapathi's article for the rule itself, not this table.
 */
const BPHS_NATURAL_FRIENDSHIP: readonly (readonly number[])[] = [
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
 * takes Saturn's row and column, Ketu takes Mars's. This is an assumption of the unverified
 * rules, kept here only because rule 1 (kept, sourced) depends on it.
 */
function friendshipRow(lord: KPPlanetLord): KPPlanetLord {
  if (lord === 'Rahu') return 'Saturn';
  if (lord === 'Ketu') return 'Mars';
  return lord;
}

/** How `a` regards `b` in natural friendship (not necessarily symmetric). */
function regards(a: KPPlanetLord, b: KPPlanetLord): number {
  if (a === b) return FRIEND;
  const rowLord = friendshipRow(a);
  const colLord = friendshipRow(b);
  if (rowLord === colLord) return FRIEND;
  const i = FRIENDSHIP_ORDER.indexOf(rowLord);
  const j = FRIENDSHIP_ORDER.indexOf(colLord);
  return BPHS_NATURAL_FRIENDSHIP[i][j];
}

/**
 * Rule 1's scoring (KP-Qt's `directionPair`): `total` split across the two directions. A
 * direction scores half unless the first planet regards the second as an enemy.
 */
function directionPair(a: KPPlanetLord, b: KPPlanetLord, total: number): number {
  let s = 0;
  if (regards(a, b) !== ENEMY) s += total / 2;
  if (regards(b, a) !== ENEMY) s += total / 2;
  return s;
}

// ---------------------------------------------------------------------------
// Elements (rule 3)
// ---------------------------------------------------------------------------

/** Fire=0, earth=1, air=2, water=3 from Aries, repeating (KP-Qt's `kEl`). */
function elementOf(signIndex: number): number {
  return signIndex % 4;
}

/**
 * Kuppu's compatible element pairs, as an unordered pair (KP-Qt's `elementsCompatible`):
 * fire-fire, water-water, fire-air, earth-water, air-water. Air-air and earth-earth are not in
 * the list.
 */
function elementsCompatible(signIndexA: number, signIndexB: number): boolean {
  let a = elementOf(signIndexA);
  let b = elementOf(signIndexB);
  if (a > b) [a, b] = [b, a];
  if (a === 0 && b === 0) return true; // fire-fire
  if (a === 3 && b === 3) return true; // water-water
  if (a === 0 && b === 2) return true; // fire-air
  if (a === 1 && b === 3) return true; // earth-water
  if (a === 2 && b === 3) return true; // air-water
  return false;
}

// ---------------------------------------------------------------------------
// Aspects (rule 4)
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
 * Rule 4 for one chart (KP-Qt's `rule4Chart`): major aspects only, the closest one inside the
 * orb wins. Favourable (conjunction, sextile, trine) scores 50; square, opposition, or no aspect
 * inside the orb scores 0.
 */
function rule4Aspect(lonA: number, lonB: number, orbDeg: number): number {
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
// Houses (rule 6)
// ---------------------------------------------------------------------------

/** Rule 6's favourable houses (KP-Qt's `goodHouse`): 2, 3, 5, 7, 9, 11. */
const GOOD_HOUSES = new Set([2, 3, 5, 7, 9, 11]);

function houseOfPlanet(chart: FullChartCalculationResult, lord: KPPlanetLord): number {
  const planet = chart.planetPositions.find((p) => p.name === lord);
  if (!planet) throw new Error(`Chart has no planet position for ${lord}`); // cannot happen: all 9 KP bodies are always computed
  return planet.house;
}

// ---------------------------------------------------------------------------
// Dasha lord at the checking date (rule 10)
// ---------------------------------------------------------------------------

/** The period in `periods` (assumed contiguous and sorted) active at `atUtc`. */
function activePeriod(periods: DashaPeriod[], atUtc: Date): DashaPeriod {
  for (let i = 0; i < periods.length; i++) {
    const isLast = i === periods.length - 1;
    const nextStart = isLast ? null : new Date(`${periods[i + 1].startDate}T00:00:00Z`);
    if (isLast || atUtc < nextStart!) return periods[i];
  }
  // periods is never empty: calculateVimshottariDasha always returns at least one dasha.
  return periods[periods.length - 1];
}

/** Dasha, bhukti and antara lord active at `atUtc` (KP-Qt's `dashaAt`, levels 0-2). */
function dashaLordsAt(moonSiderealLon: number, birthUtc: Date, atUtc: Date): {
  dasha: KPPlanetLord;
  bhukti: KPPlanetLord;
  antara: KPPlanetLord;
} {
  // Generate enough dashas to cover `atUtc`: a full Vimshottari cycle is 9 dashas (120 years).
  let numDashas = 9;
  let balance = calculateVimshottariDasha(moonSiderealLon, birthUtc, { numDashas });
  for (let guard = 0; guard < 100; guard++) {
    const last = balance.dashaTimeline[balance.dashaTimeline.length - 1];
    if (atUtc <= new Date(`${last.endDate}T00:00:00Z`)) break;
    numDashas += 9;
    balance = calculateVimshottariDasha(moonSiderealLon, birthUtc, { numDashas });
  }

  const dasha = activePeriod(balance.dashaTimeline, atUtc);
  const bhukti = activePeriod(dasha.subPeriods ?? [], atUtc);
  const antara = activePeriod(bhukti.subPeriods ?? [], atUtc);
  return { dasha: dasha.lord, bhukti: bhukti.lord, antara: antara.lord };
}

// ---------------------------------------------------------------------------
// Civil time -> UTC instant
// ---------------------------------------------------------------------------

/** Same convention as the engine's internal `chartInstantUtc`: civil clock time minus the UTC offset. */
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

function birthUtcOf(input: DateTimeLocation): Date {
  if (input.utcOffsetHours === undefined) {
    throw new RangeError('utcOffsetHours is required: a missing offset is not treated as UTC');
  }
  return toUtcInstant(
    input.year,
    input.month,
    input.day,
    input.hour,
    input.minute,
    input.second,
    input.utcOffsetHours
  );
}

// ---------------------------------------------------------------------------
// calculateMatch
// ---------------------------------------------------------------------------

const RULE_DESCRIPTIONS: ReadonlyArray<{ id: number; description: string }> = [
  { id: 1, description: 'CHARACTERISTICS COMPATIBILITY' },
  { id: 3, description: 'ATTITUDES AND URGES' },
  { id: 4, description: 'GENERAL HAPPINESS' },
  { id: 6, description: 'PLEASURE AND HAPPINESS AFTER MARRIAGE' },
  { id: 7, description: 'GENERAL SUITABILITY FOR MARRIAGE' },
  { id: 8, description: 'LIKELIHOOD OF MARRIAGE WITH THIS BOY AND THE GIRL' },
  { id: 10, description: 'WHETHER THE PERIOD LORDS NOW OPERATING IN BOTH CHARTS INDICATE DESIRABILITY OF MATCHING FOR MARRIAGE' },
];

function keyLords(
  chart: FullChartCalculationResult,
  dasha: { dasha: KPPlanetLord; bhukti: KPPlanetLord; antara: KPPlanetLord }
): MatchChartKeyLords {
  const asc = chart.cusps[0]; // house 1
  const seventh = chart.cusps[6]; // house 7
  const moon = chart.planetPositions.find((p) => p.name === 'Moon');
  if (!moon) throw new Error('Chart has no Moon position'); // cannot happen: the Moon is always computed
  return {
    ascendant: { signLord: asc.signLord, starLord: asc.starLord, subLord: asc.subLord },
    seventhCuspSub: { signLord: seventh.signLord, starLord: seventh.starLord, subLord: seventh.subLord },
    moonStarLord: moon.starLord,
    dayLord: chart.rulingPlanets.dayLord,
    dashaLordsAtChecking: dasha,
    rulingPlanetsList: chart.rulingPlanets.rulingPlanetsList,
  };
}

/**
 * The KP Dasavidha Porutham match for a boy's and a girl's chart, at a checking date. Rules 2, 5
 * and 9 are omitted (see the file header); the kept rules (1, 3, 4, 6, 7, 8, 10) are each worth
 * 100 marks, for `maxTotal` 700.
 *
 * `input.ayanamsa` and `input.rulingPlanetSet` are required (#22 decided; #24 open), as is
 * `input.nodeAgentRuleSet` (#23 open), because `calculateChart` needs all three; this module does
 * not use the Rahu/Ketu agent significators it adds.
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

  const boyChart = calculateChart(input.boy, options);
  const girlChart = calculateChart(input.girl, options);

  // The checking instant: noon civil time at the checking date, in the girl's offset (as in
  // KP-Qt). TODO(#NN): this convention is unconfirmed.
  const checkingUtc = toUtcInstant(
    input.checking.year,
    input.checking.month,
    input.checking.day,
    12,
    0,
    0,
    input.checking.utcOffsetHours
  );

  const boyMoon = boyChart.planetPositions.find((p) => p.name === 'Moon');
  const girlMoon = girlChart.planetPositions.find((p) => p.name === 'Moon');
  if (!boyMoon || !girlMoon) {
    throw new Error('Chart has no Moon position'); // cannot happen: the Moon is always computed
  }
  const boyDasha = dashaLordsAt(boyMoon.siderealLongitude, birthUtcOf(input.boy), checkingUtc);
  const girlDasha = dashaLordsAt(girlMoon.siderealLongitude, birthUtcOf(input.girl), checkingUtc);

  const boyAsc = boyChart.cusps[0];
  const girlAsc = girlChart.cusps[0];
  const boySeventh = boyChart.cusps[6];
  const girlSeventh = girlChart.cusps[6];
  const boyRuling = boyChart.rulingPlanets.rulingPlanetsList;
  const girlRuling = girlChart.rulingPlanets.rulingPlanetsList;

  // Rule 1: CHARACTERISTICS COMPATIBILITY (Ascendant sub lords, BPHS natural friendship).
  const m1 = directionPair(boyAsc.subLord, girlAsc.subLord, 100);

  // Rule 3: ATTITUDES AND URGES (Ascendant sign elements).
  const m3 = elementsCompatible(boyAsc.signIndex, girlAsc.signIndex) ? 100 : 0;

  // Rule 4: GENERAL HAPPINESS (aspect between the two Ascendant sign lords, in each own chart).
  const m4 =
    rule4Aspect(
      boyChart.planetPositions.find((p) => p.name === boyAsc.signLord)!.siderealLongitude,
      boyChart.planetPositions.find((p) => p.name === girlAsc.signLord)!.siderealLongitude,
      input.aspectOrbDeg
    ) +
    rule4Aspect(
      girlChart.planetPositions.find((p) => p.name === boyAsc.signLord)!.siderealLongitude,
      girlChart.planetPositions.find((p) => p.name === girlAsc.signLord)!.siderealLongitude,
      input.aspectOrbDeg
    );

  // Rule 6: PLEASURE AND HAPPINESS AFTER MARRIAGE (each one's Moon star lord, by house in the
  // other's chart).
  const m6 =
    (GOOD_HOUSES.has(houseOfPlanet(girlChart, boyMoon.starLord)) ? 50 : 0) +
    (GOOD_HOUSES.has(houseOfPlanet(boyChart, girlMoon.starLord)) ? 50 : 0);

  // Rule 7: GENERAL SUITABILITY FOR MARRIAGE (7th cusp lords against the other's ruling planets).
  let m7 = 0;
  for (const lord of [boySeventh.signLord, boySeventh.starLord, boySeventh.subLord]) {
    if (girlRuling.includes(lord)) m7 += 50 / 3;
  }
  for (const lord of [girlSeventh.signLord, girlSeventh.starLord, girlSeventh.subLord]) {
    if (boyRuling.includes(lord)) m7 += 50 / 3;
  }

  // Rule 8: LIKELIHOOD OF MARRIAGE (one's ruling planets against the other's significators of
  // houses 2, 7, 11).
  let m8 = 0;
  for (const house of [2, 7, 11]) {
    const girlSig = girlChart.significators.houseWise[house - 1].allSignificators;
    const boySig = boyChart.significators.houseWise[house - 1].allSignificators;
    if (boyRuling.some((p) => girlSig.includes(p))) m8 += 50 / 3;
    if (girlRuling.some((p) => boySig.includes(p))) m8 += 50 / 3;
  }

  // Rule 10: PERIOD LORDS (each one's dasha/bhukti/antara lord at the checking date, against the
  // other's ruling planets).
  let m10 = 0;
  for (const lord of [boyDasha.dasha, boyDasha.bhukti, boyDasha.antara]) {
    if (girlRuling.includes(lord)) m10 += 50 / 3;
  }
  for (const lord of [girlDasha.dasha, girlDasha.bhukti, girlDasha.antara]) {
    if (boyRuling.includes(lord)) m10 += 50 / 3;
  }

  const marksById = new Map<number, number>([
    [1, m1],
    [3, m3],
    [4, m4],
    [6, m6],
    [7, m7],
    [8, m8],
    [10, m10],
  ]);

  const rules: MatchRuleResult[] = RULE_DESCRIPTIONS.map(({ id, description }) => ({
    id,
    description,
    marks: marksById.get(id)!,
  }));
  const total = rules.reduce((sum, r) => sum + r.marks, 0);

  const warnings = [
    ...boyChart.warnings.map((w) => ({ ...w, message: `Boy's chart: ${w.message}` })),
    ...girlChart.warnings.map((w) => ({ ...w, message: `Girl's chart: ${w.message}` })),
  ];

  return {
    rules,
    total,
    maxTotal: MAX_TOTAL,
    totalPercent: (total / MAX_TOTAL) * 100,
    boy: keyLords(boyChart, boyDasha),
    girl: keyLords(girlChart, girlDasha),
    warnings,
  };
}
