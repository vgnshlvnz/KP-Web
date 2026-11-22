import { describe, it, expect } from 'vitest';
import app from '../src/index.js';
import { calculateChart } from '../src/engine/index.js';
import type { ChartCalculationOptions, DateTimeLocation, DashaPeriod } from '../src/engine/types.js';
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
  calculateMatch,
  MatchingDateOutOfRangeError,
  MAX_TOTAL_MARKS,
} from '../src/engine/matching.js';

/**
 * KP Dasavidha Porutham matching (work package `build/horoscope-match`). Rules 2, 5, 9 omitted
 * (owner, 2026-11-22); see `src/engine/matching.ts`'s header comment for why.
 */

const post = (path: string, body: unknown) =>
  app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

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

const CHECKING_DATE_UTC = localNoonUtc(1986, 2, 1, 8);

describe('calculateMatch (Kiran Raj / Chandra Pravina reference charts)', () => {
  const boy = calculateChart(BOY_INPUT, options);
  const girl = calculateChart(GIRL_INPUT, options);
  const result = calculateMatch(boy, girl, CHECKING_DATE_UTC);

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
    expect(result.percent).toBeCloseTo((expectedTotal / MAX_TOTAL_MARKS) * 100, 6);
  });

  it('forwards both charts\' warnings, boy\'s then girl\'s', () => {
    // None of boy's near_sub_boundary warnings (cusp2, cusp12, Mercury, Venus) or girl's (cusp3, cusp9)
    // touch the fields the rules above actually read (both Ascendants, both 7th cusps, both Moons,
    // the Moon-star-lord house placements, the ruling-planet lists, or the dasha lookup) -- so no
    // boundary-range assertion is needed for this fixture's rule marks, only that the warnings are
    // still carried through unmodified.
    expect(result.warnings).toEqual([...boy.warnings, ...girl.warnings]);
    expect(result.warnings.length).toBe(boy.warnings.length + girl.warnings.length);
  });

  it('echoes each person\'s Asc/7th lords, Moon star lord, day lord and dasha lords at the checking date', () => {
    expect(result.boy.ascendantSignLord).toBe(boy.cusps[0].signLord);
    expect(result.boy.seventhCuspLords.signLord).toBe(boy.cusps[6].signLord);
    expect(result.boy.moonStarLord).toBe(boy.planetPositions.find((p) => p.name === 'Moon')!.starLord);
    expect(result.boy.dayLord).toBe(boy.rulingPlanets.dayLord);
    expect(result.girl.dashaLordsAtChecking).toEqual(dashaLordsAt(girl.dashaBalance.dashaTimeline, CHECKING_DATE_UTC));
  });

  it('throws MatchingDateOutOfRangeError for a checking date before birth', () => {
    expect(() => calculateMatch(boy, girl, new Date('1900-01-01T00:00:00Z'))).toThrow(MatchingDateOutOfRangeError);
  });
});

// ---------------------------------------------------------------------------
// Route: POST /api/match
// ---------------------------------------------------------------------------

describe('POST /api/match', () => {
  const validBody = () => ({
    ayanamsa: 'kp_new',
    boy: BOY_INPUT,
    girl: GIRL_INPUT,
    checkingDate: { year: 1986, month: 2, day: 1 },
  });

  it('computes a match for the two reference charts', async () => {
    const res = await post('/api/match', validBody());
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.maxTotal).toBe(700);
    expect(json.rules.map((r: any) => r.id)).toEqual([1, 3, 4, 6, 7, 8, 10]);
    expect(json.boy.location).toBeNull();
    expect(json.girl.location).toBeNull();
  });

  it('400s on missing ayanamsa', async () => {
    const body = validBody() as any;
    delete body.ayanamsa;
    const res = await post('/api/match', body);
    expect(res.status).toBe(400);
  });

  it('400s on missing checkingDate', async () => {
    const body = validBody() as any;
    delete body.checkingDate;
    const res = await post('/api/match', body);
    expect(res.status).toBe(400);
  });

  it('400s when boy sends both locationId and latitude', async () => {
    const body = validBody() as any;
    body.boy = { ...body.boy, locationId: 916 };
    const res = await post('/api/match', body);
    expect(res.status).toBe(400);
  });

  it('400s when girl sends both locationId and latitude', async () => {
    const body = validBody() as any;
    body.girl = { ...body.girl, locationId: 919 };
    const res = await post('/api/match', body);
    expect(res.status).toBe(400);
  });
});
