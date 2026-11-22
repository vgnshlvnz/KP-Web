/**
 * KP Dasavidha Porutham: horoscope matching (work package `build/horoscope-match`).
 *
 * Ported from KP-Qt's `src/horomatch.cpp` (vgnshlvnz/KP-Qt @83264c6). Source named by the reference
 * program's own matching report: K. P. Kuppu Ganapathi, "KP Dasavidha Porutham", K.P. & Astrology
 * Year Book 1997, pp. 32-44.
 *
 * Owner decision (2026-11-22): rules 2, 5 and 9 are OMITTED, not computed as null rows. KP-Qt marks
 * them "unverified" in its own source (the friendship table substitution for rule 2, the aspect-class
 * list for rule 5, and the "connected" definition for rule 9 are none of them in Kuppu's article) and
 * ships a `Reading::ReferenceFitted` mode that exists only to reproduce one screenshot ("not a sourced
 * reading", KP-Qt `horomatch.h`). Neither the unverified default nor the fitted override is ported.
 * The remaining seven rules (1, 3, 4, 6, 7, 8, 10) keep their KP-Qt rule numbers and titles, each
 * worth 100, for a total out of 700 (`MAX_TOTAL_MARKS`).
 *
 * Rule 4's orb is fixed at Kuppu's sourced value, 7 degrees (`RULE_4_ORB_DEG`), not a request field
 * (owner, 2026-11-22): KP-Qt only ever exposed it as a UI convenience, never a different sourced value.
 *
 * KP-Qt's `Reading::ReferenceFitted` dasha year (365.25) is not used here: dasha lords come from this
 * engine's own `calculateVimshottariDasha`, which uses `DASHA_YEAR_DAYS` (365.2425, `conventions.ts`,
 * #29 owner 2026-11-21) like every other chart in KP-Web.
 *
 * Inputs are two already-computed `FullChartCalculationResult`s (boy, girl) and the checking instant
 * in UTC. This module holds no HTTP parsing and no owner-decision defaults of its own: ayanamsa,
 * `nodeAgentRuleSet` and `rulingPlanetSet` are whatever the caller used to compute the two charts.
 */
import type {
  ChartWarning,
  DashaPeriod,
  FullChartCalculationResult,
  KPPlanetLord,
  PlanetName,
} from './types.js';

// ---------------------------------------------------------------------------
// Rule titles (KP-Qt `kDesc`, `horomatch.cpp:406-418`). Rules 2, 5, 9 omitted (owner, 2026-11-22).
// ---------------------------------------------------------------------------

const RULE_TITLES: Record<number, string> = {
  1: 'CHARACTERISTICS COMPATIBILITY',
  3: 'ATTITUDES AND URGES',
  4: 'GENERAL HAPPINESS',
  6: 'PLEASURE AND HAPPINESS AFTER MARRIAGE',
  7: 'GENERAL SUITABILITY FOR MARRIAGE',
  8: 'LIKELIHOOD OF MARRIAGE WITH THIS BOY AND THE GIRL',
  10: 'WHETHER THE PERIOD LORDS NOW OPERATING IN BOTH CHARTS INDICATE DESIRABILITY OF MATCHING FOR MARRIAGE',
};

/** Kuppu's rule 4 orb, degrees (`horomatch.cpp` `kKuppuOrbDeg`). Not a request field (owner, 2026-11-22). */
export const RULE_4_ORB_DEG = 7.0;

/** Seven rules kept, 100 marks each (`horomatch.cpp:737-748`, less rules 2, 5, 9). */
export const MAX_TOTAL_MARKS = 700;

export interface RuleMarkResult {
  /** KP-Qt's rule number (kept, so the gaps at 2, 5 and 9 are visible). */
  id: number;
  description: string;
  marks: number;
  maxMarks: number;
}

export interface SeventhCuspLords {
  signLord: KPPlanetLord;
  starLord: KPPlanetLord;
  subLord: KPPlanetLord;
}

export interface DashaLordsAtChecking {
  dasha: KPPlanetLord;
  bhukti: KPPlanetLord;
  antara: KPPlanetLord;
}

/** Per-person fields the report echoes back, beyond the rule marks themselves. */
export interface MatchPersonSummary {
  ascendantSignLord: KPPlanetLord;
  ascendantStarLord: KPPlanetLord;
  ascendantSubLord: KPPlanetLord;
  seventhCuspLords: SeventhCuspLords;
  moonStarLord: KPPlanetLord;
  dayLord: KPPlanetLord | null;
  dashaLordsAtChecking: DashaLordsAtChecking;
}

export interface MatchResult {
  rules: RuleMarkResult[];
  total: number;
  maxTotal: number;
  percent: number;
  checkingDateUtc: string;
  boy: MatchPersonSummary;
  girl: MatchPersonSummary;
  /** Both charts' own warnings (`polar_fallback`, `near_sub_boundary`, `no_sunrise`), boy's then girl's. */
  warnings: ChartWarning[];
}

/** `checkingDate` falls outside the computed dasha timeline (before birth, or beyond its last period). */
export class MatchingDateOutOfRangeError extends Error {}

// ---------------------------------------------------------------------------
// Rule 1: Asc sub-lords, BPHS 3.55 natural friendship (`horomatch.cpp:146-206`).
// ---------------------------------------------------------------------------

/** BPHS 3.55 natural friendship: row regards column. 0 = friend, 1 = neutral, 2 = enemy. */
const BPHS_ORDER: readonly KPPlanetLord[] = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
const FRIEND = 0;
const ENEMY = 2;
const BPHS_TABLE: readonly (readonly number[])[] = [
  /* Sun */ [FRIEND, FRIEND, FRIEND, 1, FRIEND, ENEMY, ENEMY],
  /* Moon */ [FRIEND, FRIEND, 1, FRIEND, 1, 1, 1],
  /* Mars */ [FRIEND, FRIEND, FRIEND, ENEMY, FRIEND, 1, 1],
  /* Mercury */ [FRIEND, ENEMY, 1, FRIEND, 1, FRIEND, 1],
  /* Jupiter */ [FRIEND, FRIEND, FRIEND, ENEMY, FRIEND, ENEMY, 1],
  /* Venus */ [ENEMY, ENEMY, 1, FRIEND, 1, FRIEND, FRIEND],
  /* Saturn */ [ENEMY, ENEMY, ENEMY, FRIEND, 1, FRIEND, FRIEND],
];

/** BPHS has no nodes: Rahu takes Saturn's row/column, Ketu takes Mars's (`horomatch.cpp:174-183`). */
function bphsRow(lord: KPPlanetLord): KPPlanetLord {
  if (lord === 'Rahu') return 'Saturn';
  if (lord === 'Ketu') return 'Mars';
  return lord;
}

export function regards(a: KPPlanetLord, b: KPPlanetLord): typeof FRIEND | 1 | typeof ENEMY {
  if (a === b) return FRIEND;
  const ra = bphsRow(a);
  const rb = bphsRow(b);
  if (ra === rb) return FRIEND;
  return BPHS_TABLE[BPHS_ORDER.indexOf(ra)][BPHS_ORDER.indexOf(rb)] as typeof FRIEND | 1 | typeof ENEMY;
}

/** Rule 1: 50/50 split across the two directions; a direction scores unless it regards the other as an enemy. */
export function directionPair(a: KPPlanetLord, b: KPPlanetLord, total: number): number {
  let s = 0;
  if (regards(a, b) !== ENEMY) s += total / 2;
  if (regards(b, a) !== ENEMY) s += total / 2;
  return s;
}

// ---------------------------------------------------------------------------
// Rule 3: Asc sign elements (`horomatch.cpp:211-229`).
// ---------------------------------------------------------------------------

/** Fire, earth, air, water, repeating from Aries (sign index 0-11). */
const ELEMENT_OF_SIGN = [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3] as const;

/** Kuppu's compatible pairs: fire-fire, water-water, fire-air, earth-water, air-water. */
function elementsCompatible(signA: number, signB: number): boolean {
  let a = ELEMENT_OF_SIGN[signA];
  let b = ELEMENT_OF_SIGN[signB];
  if (a > b) [a, b] = [b, a];
  return (a === 0 && b === 0) || (a === 3 && b === 3) || (a === 0 && b === 2) || (a === 1 && b === 3) || (a === 2 && b === 3);
}

/** Rule 3: 100 if the two Asc signs' elements are compatible, else 0. */
export function rule3Score(signA: number, signB: number): number {
  return elementsCompatible(signA, signB) ? 100 : 0;
}

// ---------------------------------------------------------------------------
// Rule 4: aspect between Asc sign lords, fixed 7 degree orb (`horomatch.cpp:231-258`).
// ---------------------------------------------------------------------------

function angularSeparation(lonA: number, lonB: number): number {
  const norm = (x: number) => ((x % 360) + 360) % 360;
  let d = Math.abs(norm(lonA) - norm(lonB));
  if (d > 180) d = 360 - d;
  return d;
}

/** Conjunction, sextile and trine are favourable (50 marks, closest aspect inside the orb wins). */
const RULE_4_ASPECTS: readonly { angle: number; favourable: boolean }[] = [
  { angle: 0, favourable: true },
  { angle: 60, favourable: true },
  { angle: 90, favourable: false },
  { angle: 120, favourable: true },
  { angle: 180, favourable: false },
];

/** Rule 4, one direction: 50 if the closest aspect within `orbDeg` is favourable, else 0. */
export function rule4Score(lonA: number, lonB: number, orbDeg: number): number {
  const d = angularSeparation(lonA, lonB);
  let best: { angle: number; favourable: boolean } | null = null;
  let bestOrb = Infinity;
  for (const aspect of RULE_4_ASPECTS) {
    const o = Math.abs(d - aspect.angle);
    if (o <= orbDeg + 1e-9 && o < bestOrb) {
      bestOrb = o;
      best = aspect;
    }
  }
  return best && best.favourable ? 50 : 0;
}

// ---------------------------------------------------------------------------
// Rule 6: Moon star lord's house in the OTHER chart, benefic houses (`horomatch.cpp:271-274,694-696`).
// ---------------------------------------------------------------------------

const BENEFIC_HOUSES = new Set([2, 3, 5, 7, 9, 11]);

/** Rule 6: whether a house is one of Kuppu's benefic houses (2, 3, 5, 7, 9, 11). */
export function isBeneficHouse(house: number): boolean {
  return BENEFIC_HOUSES.has(house);
}

function houseOfPlanet(chart: FullChartCalculationResult, planet: KPPlanetLord): number {
  const p = chart.planetPositions.find((x) => x.name === (planet as PlanetName));
  if (!p) throw new Error(`Chart has no planet position for ${planet}`); // cannot happen: the 9 KP bodies are always computed
  return p.house;
}

function planetLongitude(chart: FullChartCalculationResult, planet: KPPlanetLord): number {
  const p = chart.planetPositions.find((x) => x.name === (planet as PlanetName));
  if (!p) throw new Error(`Chart has no planet position for ${planet}`); // cannot happen: the 9 KP bodies are always computed
  return p.siderealLongitude;
}

// ---------------------------------------------------------------------------
// Rules 7, 8 and 10 share the same "count membership, 50/3 each, out of 3" shape
// (`horomatch.cpp:698-716,729-735`): each of up to 3 named lords scores 50/3 if present in the
// other chart's ruling-planet list (or, for rule 8, if the two sets overlap at all).
// ---------------------------------------------------------------------------

const MEMBERSHIP_UNIT = 50 / 3;

/** Rules 7 and 10: 50/3 for each of `lords` that is in `rulingPlanets` (so up to 100 for 3 lords). */
export function lordScore(lords: readonly KPPlanetLord[], rulingPlanets: readonly KPPlanetLord[]): number {
  let score = 0;
  for (const lord of lords) {
    if (rulingPlanets.includes(lord)) score += MEMBERSHIP_UNIT;
  }
  return score;
}

/** Rule 8, one house one direction: 50/3 if any of `rulingPlanets` significates that house. */
export function significatorScore(rulingPlanets: readonly KPPlanetLord[], houseSignificators: readonly string[]): number {
  return rulingPlanets.some((p) => houseSignificators.includes(p)) ? MEMBERSHIP_UNIT : 0;
}

// ---------------------------------------------------------------------------
// Rule 10: dasha lord at the checking date, walking the already-computed timeline.
// ---------------------------------------------------------------------------

function containingPeriod(periods: DashaPeriod[], whenMs: number): DashaPeriod | null {
  for (const p of periods) {
    const start = Date.parse(`${p.startDate}T00:00:00Z`);
    const end = Date.parse(`${p.endDate}T00:00:00Z`);
    if (whenMs >= start && whenMs < end) return p;
  }
  return null;
}

/** Rule 10's dasha/bhukti/antara lookup, walking a chart's own already-computed `dashaTimeline`. */
export function dashaLordsAt(dashaTimeline: DashaPeriod[], whenUtc: Date): DashaLordsAtChecking {
  const whenMs = whenUtc.getTime();
  const dasha = containingPeriod(dashaTimeline, whenMs);
  if (!dasha) {
    throw new MatchingDateOutOfRangeError(
      `checkingDate (${whenUtc.toISOString().slice(0, 10)}) is outside the computed dasha timeline: ` +
        `before birth, or beyond the last of its ${dashaTimeline.length} major periods.`
    );
  }
  const bhukti = containingPeriod(dasha.subPeriods ?? [], whenMs);
  if (!bhukti) {
    throw new MatchingDateOutOfRangeError(`checkingDate falls outside the computed bhukti periods of the ${dasha.lord} dasha.`);
  }
  const antara = containingPeriod(bhukti.subPeriods ?? [], whenMs);
  if (!antara) {
    throw new MatchingDateOutOfRangeError(`checkingDate falls outside the computed antara periods of the ${bhukti.lord} bhukti.`);
  }
  return { dasha: dasha.lord, bhukti: bhukti.lord, antara: antara.lord };
}

// ---------------------------------------------------------------------------
// calculateMatch
// ---------------------------------------------------------------------------

/**
 * Local noon in a place's civil offset, as a UTC instant. KP-Qt's checking instant is "12:00 civil
 * time in the girl's zone" (`horomatch.h:121`, `horomatch.cpp:654-663`); kept here (owner, 2026-11-22).
 */
export function localNoonUtc(year: number, month: number, day: number, utcOffsetHours: number): Date {
  const dayStart = new Date(0);
  dayStart.setUTCFullYear(year, month - 1, day);
  dayStart.setUTCHours(0, 0, 0, 0);
  return new Date(dayStart.getTime() + 12 * 3_600_000 - utcOffsetHours * 3_600_000);
}

function summarize(chart: FullChartCalculationResult, dashaAtChecking: DashaLordsAtChecking): MatchPersonSummary {
  const asc = chart.cusps[0];
  const seventh = chart.cusps[6];
  const moon = chart.planetPositions.find((p) => p.name === 'Moon');
  if (!moon) throw new Error('Chart has no Moon position'); // cannot happen: the Moon is always computed
  return {
    ascendantSignLord: asc.signLord,
    ascendantStarLord: asc.starLord,
    ascendantSubLord: asc.subLord,
    seventhCuspLords: { signLord: seventh.signLord, starLord: seventh.starLord, subLord: seventh.subLord },
    moonStarLord: moon.starLord,
    dayLord: chart.rulingPlanets.dayLord,
    dashaLordsAtChecking: dashaAtChecking,
  };
}

/**
 * KP Dasavidha Porutham, rules 1, 3, 4, 6, 7, 8 and 10 (owner, 2026-11-22: 2, 5, 9 omitted).
 *
 * `boy` and `girl` are already-computed charts (same `ChartCalculationOptions`, i.e. the same
 * ayanamsa, node-agent rule set and ruling-planet set for both); `checkingDateUtc` is the checking
 * instant as a UTC `Date` (KP-Qt: noon civil time in the girl's place, see `localNoonUtc`).
 */
export function calculateMatch(
  boy: FullChartCalculationResult,
  girl: FullChartCalculationResult,
  checkingDateUtc: Date
): MatchResult {
  const boyAsc = boy.cusps[0];
  const girlAsc = girl.cusps[0];
  const boySeventh = boy.cusps[6];
  const girlSeventh = girl.cusps[6];

  // Rule 1: 100.00, Asc sub-lords (`horomatch.cpp:677`).
  const m1 = directionPair(boyAsc.subLord, girlAsc.subLord, 100);

  // Rule 3: 100 or 0, Asc sign elements (`horomatch.cpp:680-681`).
  const m3 = rule3Score(boyAsc.signIndex, girlAsc.signIndex);

  // Rule 4: two 50s, Asc sign lords' aspect, read from each person's OWN ephemeris (`horomatch.cpp:682-685`).
  const m4 =
    rule4Score(planetLongitude(boy, boyAsc.signLord), planetLongitude(boy, girlAsc.signLord), RULE_4_ORB_DEG) +
    rule4Score(planetLongitude(girl, boyAsc.signLord), planetLongitude(girl, girlAsc.signLord), RULE_4_ORB_DEG);

  // Rule 6: two 50s, Moon's star lord's house in the OTHER chart (`horomatch.cpp:694-696`).
  const boyMoonStarLord = boy.planetPositions.find((p) => p.name === 'Moon')!.starLord;
  const girlMoonStarLord = girl.planetPositions.find((p) => p.name === 'Moon')!.starLord;
  const m6 =
    (isBeneficHouse(houseOfPlanet(girl, boyMoonStarLord)) ? 50 : 0) +
    (isBeneficHouse(houseOfPlanet(boy, girlMoonStarLord)) ? 50 : 0);

  // Rule 7: six x 50/3, 7th cusp lords vs the OTHER's ruling-planet list (`horomatch.cpp:698-708`).
  const m7 =
    lordScore([boySeventh.signLord, boySeventh.starLord, boySeventh.subLord], girl.rulingPlanets.rulingPlanetsList) +
    lordScore([girlSeventh.signLord, girlSeventh.starLord, girlSeventh.subLord], boy.rulingPlanets.rulingPlanetsList);

  // Rule 8: six x 50/3, houses 2/7/11 significators vs the OTHER's ruling-planet list (`horomatch.cpp:710-716`).
  // `allSignificators` is KP-Qt's `significators()`: the union of all four levels.
  let m8 = 0;
  for (const house of [2, 7, 11]) {
    const girlSig = girl.significators.houseWise.find((h) => h.house === house)!.allSignificators;
    const boySig = boy.significators.houseWise.find((h) => h.house === house)!.allSignificators;
    m8 += significatorScore(boy.rulingPlanets.rulingPlanetsList, girlSig) + significatorScore(girl.rulingPlanets.rulingPlanetsList, boySig);
  }

  // Rule 10: six x 50/3, dasha/bhukti/antara lords at the checking date vs the OTHER's ruling-planet
  // list (`horomatch.cpp:729-735`). Walks the timeline `calculateChart` already computed for each chart.
  const boyDashaAtChecking = dashaLordsAt(boy.dashaBalance.dashaTimeline, checkingDateUtc);
  const girlDashaAtChecking = dashaLordsAt(girl.dashaBalance.dashaTimeline, checkingDateUtc);
  const m10 =
    lordScore(
      [boyDashaAtChecking.dasha, boyDashaAtChecking.bhukti, boyDashaAtChecking.antara],
      girl.rulingPlanets.rulingPlanetsList
    ) +
    lordScore(
      [girlDashaAtChecking.dasha, girlDashaAtChecking.bhukti, girlDashaAtChecking.antara],
      boy.rulingPlanets.rulingPlanetsList
    );

  const marks: Record<number, number> = { 1: m1, 3: m3, 4: m4, 6: m6, 7: m7, 8: m8, 10: m10 };
  const rules: RuleMarkResult[] = Object.keys(marks)
    .map(Number)
    .sort((a, b) => a - b)
    .map((id) => ({ id, description: RULE_TITLES[id], marks: marks[id], maxMarks: 100 }));
  const total = rules.reduce((sum, r) => sum + r.marks, 0);

  return {
    rules,
    total,
    maxTotal: MAX_TOTAL_MARKS,
    percent: (total / MAX_TOTAL_MARKS) * 100,
    checkingDateUtc: checkingDateUtc.toISOString(),
    boy: summarize(boy, boyDashaAtChecking),
    girl: summarize(girl, girlDashaAtChecking),
    warnings: [...boy.warnings, ...girl.warnings],
  };
}
