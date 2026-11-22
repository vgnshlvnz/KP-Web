/**
 * KP-Qt vendor ayanamsas (vgnshlvnz/KP-Qt src/livedata/kpAyanamsa.cpp).
 *
 * The expected degrees were printed by compiling those three functions
 * (g++ /tmp/kpqt-aya.cpp, the formulas copied unchanged). Tolerance is 1e-9
 * degree, about 0.0000036 arcsec, far under 1 arcsec. SWE's JSON fixture is
 * not in yet; this file is the stand-in.
 *
 * KP Straight Line (Adjusted) in KP-Web stays the owner's JD formula with no
 * nutation. It is not KP-Qt's fractional-year form; the difference is recorded
 * here and is not treated as a failure of either formula.
 */
import { describe, expect, it } from 'vitest';
import { calculateAyanamsa, calculateNutation, toJulianDate } from '../src/engine/astronomy.js';
import {
  calendarFromJulianDay,
  meanAyanamsaKpStla,
  meanAyanamsaKpStraightLineAdjustedQt,
  kpqtFracYear,
} from '../src/engine/ayanamsa-defs.js';
import { calculateChart } from '../src/engine/index.js';

/** Printed by the KP-Qt formula program. Degrees. */
const KPQT = [
  { label: '1980-01-01 10:00', y: 1980, m: 1, d: 1, h: 10, mi: 0, s: 0, straight: 23.57039261875, adjusted: 23.566394029607, kpaya: 23.487616166508 },
  { label: '1992-03-11 06:14', y: 1992, m: 3, d: 11, h: 6, mi: 14, s: 0, straight: 23.73785544375, adjusted: 23.736527200586, kpaya: 23.657813848801 },
  { label: '2000-01-01 12:00', y: 2000, m: 1, d: 1, h: 12, mi: 0, s: 0, straight: 23.849497327083, adjusted: 23.845501924067, kpaya: 23.766834708986 },
  { label: '1992-02-01 00:00', y: 1992, m: 2, d: 1, h: 0, mi: 0, s: 0, straight: 23.73785544375, adjusted: 23.735026163145, kpaya: 23.656312202119 },
  { label: '2000-02-29 12:00', y: 2000, m: 2, d: 29, h: 12, mi: 0, s: 0, straight: 23.849497327083, adjusted: 23.847757701846, kpaya: 23.769091481521 },
  { label: '1900-04-15 00:00', y: 1900, m: 4, d: 15, h: 0, mi: 0, s: 0, straight: 22.453973785417, adjusted: 22.453973785417, kpaya: 22.375 },
] as const;

const ARCSEC = 3600;
const TOL_DEG = 1e-9;

describe('KP-Qt calendar ayanamsas', () => {
  it('KP Straight Line and KP Ayanamsa match the compiled KP-Qt formulas', () => {
    for (const row of KPQT) {
      const civil = { year: row.y, month: row.m, day: row.d, hour: row.h, minute: row.mi, second: row.s };
      const jd = toJulianDate(row.y, row.m, row.d, row.h, row.mi, row.s);
      const straight = calculateAyanamsa(jd, 'kp_straight_line', 0, civil);
      const ayan = calculateAyanamsa(jd, 'kp_ayanamsa', 0, civil);
      expect(Math.abs(straight.meanAyanamsa - row.straight), row.label).toBeLessThan(TOL_DEG);
      expect(Math.abs(ayan.meanAyanamsa - row.kpaya), row.label).toBeLessThan(TOL_DEG);
      expect(straight.trueAyanamsa).toBe(straight.meanAyanamsa);
    }
  });

  it('true ayanamsa of the new modes adds nutation; KPSTLA still does not', () => {
    const jd = toJulianDate(1992, 3, 11, 6, 14, 0);
    const dPsi = calculateNutation(jd).dPsi;
    expect(dPsi).not.toBe(0);
    const civil = { year: 1992, month: 3, day: 11, hour: 6, minute: 14, second: 0 };
    for (const id of ['kp_straight_line', 'kp_ayanamsa'] as const) {
      const a = calculateAyanamsa(jd, id, dPsi, civil);
      expect(a.trueAyanamsa - a.meanAyanamsa).toBeCloseTo(dPsi, 12);
    }
    const stla = calculateAyanamsa(jd, 'kp_straight_line_adjusted', dPsi);
    expect(stla.trueAyanamsa).toBe(stla.meanAyanamsa);
  });

  it('a chart uses the local year, not the UT year, for KP Straight Line', () => {
    // 1980-01-01 02:00 at offset +8 is 1979-12-31 18:00 UT. The formula uses 1980.
    const chart = calculateChart(
      {
        year: 1980, month: 1, day: 1, hour: 2, minute: 0, second: 0,
        utcOffsetHours: 8, latitude: 3.139, longitude: 101.6869,
      },
      {
        ayanamsa: 'kp_straight_line',
        nodeAgentRuleSet: 'none',
        rulingPlanetSet: 'asc_star_sign_moon_star_sign_day_lord',
      }
    );
    const for1980 = 23.57039261875;
    const for1979 = ((1979 - 291) * 50.2388475) / 3600;
    expect(Math.abs(chart.ayanamsaValue - (for1980 + chart.nutationInLongitude))).toBeLessThan(TOL_DEG);
    expect(Math.abs(chart.ayanamsaValue - (for1979 + chart.nutationInLongitude))).toBeGreaterThan(40 / ARCSEC);
  });

  it('J2000 noon UT falls out of a Julian day as 2000-01-01 12:00', () => {
    expect(calendarFromJulianDay(2451545.0)).toEqual({
      year: 2000, month: 1, day: 1, hour: 12, minute: 0, second: 0,
    });
  });

  it('a fraction within half a second of the next midnight rolls to that midnight', () => {
    // 2000-01-01 23:59:59.6 UT. Rounding the clock to a whole second crosses into 2 January.
    const jd = 2451544.5 + 86399.6 / 86400;
    expect(calendarFromJulianDay(jd)).toEqual({
      year: 2000, month: 1, day: 2, hour: 0, minute: 0, second: 0,
    });
  });
});

describe('KP Straight Line (Adjusted): owner JD formula vs KP-Qt fractional year', () => {
  it('the two formulas are not the same; the gap at the sample dates stays under 20 arcsec', () => {
    let maxArcsec = 0;
    for (const row of KPQT) {
      const jd = toJulianDate(row.y, row.m, row.d, row.h, row.mi, row.s);
      const web = meanAyanamsaKpStla(jd);
      const qt = meanAyanamsaKpStraightLineAdjustedQt(kpqtFracYear({
        year: row.y, month: row.m, day: row.d, hour: row.h, minute: row.mi, second: row.s,
      }));
      maxArcsec = Math.max(maxArcsec, Math.abs(web - qt) * ARCSEC);
    }
    // 2000-01-01 12:00 UT: owner formula 23.849010°, KP-Qt frac form 23.845502°, about 12.6".
    expect(maxArcsec).toBeGreaterThan(10);
    expect(maxArcsec).toBeLessThan(20);
  });
});
