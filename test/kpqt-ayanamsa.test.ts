/**
 * KP Straight Line and KP Ayanamsa, ported from KP-Qt `src/livedata/kpAyanamsa.cpp`
 * (commit 83264c65).
 *
 * The expected means in `test/fixtures/kpqt-ayanamsa-formula.json` were produced by
 * compiling that file's formulas (a verbatim extract, not the KP-Qt application and
 * not the reference CLI a teammate is adding). `kl-1992-dawn` also matches the legacy
 * binary pins quoted in KP-Qt `tests/kp-golden/make_ayanref.py`:
 *   KP Ayanamsa 23.657813848801
 *   KP Straight Line 23.737855443750
 * When the CLI JSON arrives it replaces this fixture as
 * `test/fixtures/kpqt-ayanamsa-reference.json`. Tolerance here is 0.001 arcsec, under
 * the 1 arcsec aim for that file.
 *
 * KP Straight Line (Adjusted) is not these formulas. It stays the owner definition
 * (#29) and is covered by `kpstla.test.ts`. KP-Qt's "User Defined" is not a mode.
 */
import { describe, expect, it } from 'vitest';
import indexHtml from '../public/index.html?raw';
import app from '../src/index';
import { calculateAyanamsa, calculateChart } from '../src/engine/index.js';
import { AYANAMSA_LABELS, AYANAMSA_MODES, DEFAULT_AYANAMSA_SELECTION } from '../src/engine/ayanamsa-defs.js';
import fixture from './fixtures/kpqt-ayanamsa-formula.json';

const ARCSEC = 3600;
const TOLERANCE_ARCSEC = fixture.toleranceArcsec;

const LEGACY_KL_1992 = {
  year: 1992,
  month: 3,
  day: 11,
  hour: 6,
  minute: 14,
  second: 0,
} as const;

describe('KP-Qt vendor formulas (formula extract, not the reference CLI)', () => {
  it('pins the legacy binary at 1992-03-11 06:14:00 local', () => {
    const ayan = calculateAyanamsa(0, 'kp_ayanamsa', 0, LEGACY_KL_1992);
    const line = calculateAyanamsa(0, 'kp_straight_line', 0, LEGACY_KL_1992);
    expect(Math.abs(ayan.meanAyanamsa - 23.657813848801) * ARCSEC).toBeLessThan(TOLERANCE_ARCSEC);
    expect(Math.abs(line.meanAyanamsa - 23.73785544375) * ARCSEC).toBeLessThan(TOLERANCE_ARCSEC);
    expect(ayan.trueAyanamsa).toBe(ayan.meanAyanamsa);
    expect(line.trueAyanamsa).toBe(line.meanAyanamsa);
  });

  it.each(fixture.instants)('$id', (row) => {
    const civil = {
      year: row.year,
      month: row.month,
      day: row.day,
      hour: row.hour,
      minute: row.minute,
      second: row.second,
    };
    const ayan = calculateAyanamsa(0, 'kp_ayanamsa', 0, civil);
    const line = calculateAyanamsa(0, 'kp_straight_line', 0, civil);
    expect(Math.abs(ayan.meanAyanamsa - row.kp_ayanamsa) * ARCSEC).toBeLessThanOrEqual(TOLERANCE_ARCSEC);
    expect(Math.abs(line.meanAyanamsa - row.kp_straight_line) * ARCSEC).toBeLessThanOrEqual(TOLERANCE_ARCSEC);
  });

  it('adds nutation to the true value, and KP Straight Line depends only on the civil year', () => {
    const dPsi = 0.004;
    const a = calculateAyanamsa(2451545, 'kp_ayanamsa', dPsi, { year: 2000, month: 6, day: 1, hour: 0, minute: 0, second: 0 });
    const early = calculateAyanamsa(2451545, 'kp_straight_line', dPsi, { year: 2000, month: 1, day: 1, hour: 0, minute: 0, second: 0 });
    const late = calculateAyanamsa(2451545, 'kp_straight_line', dPsi, { year: 2000, month: 12, day: 31, hour: 23, minute: 0, second: 0 });
    expect(a.trueAyanamsa - a.meanAyanamsa).toBeCloseTo(dPsi, 12);
    expect(early.meanAyanamsa).toBe(late.meanAyanamsa);
    expect(early.trueAyanamsa - early.meanAyanamsa).toBeCloseTo(dPsi, 12);
    const previousYear = calculateAyanamsa(2451545, 'kp_straight_line', 0, { year: 1999, month: 12, day: 31, hour: 23, minute: 0, second: 0 });
    expect(Math.abs(early.meanAyanamsa - previousYear.meanAyanamsa) * ARCSEC).toBeCloseTo(50.2388475, 6);
  });
});

describe('KP-Qt formulas on a chart use the local civil date', () => {
  const place = { latitude: 3.139, longitude: 101.6869 };

  it('KP Straight Line keeps the local year across a timezone that is still the previous UT year', () => {
    const localNewYear = {
      year: 2000,
      month: 1,
      day: 1,
      hour: 0,
      minute: 30,
      second: 0,
      utcOffsetHours: 8,
      ...place,
    };
    const chart = calculateChart(localNewYear, {
      ayanamsa: 'kp_straight_line',
      nodeAgentRuleSet: 'none',
      rulingPlanetSet: 'asc_star_sign_moon_star_sign_day_lord',
    });
    const expected = calculateAyanamsa(0, 'kp_straight_line', 0, localNewYear).meanAyanamsa;
    expect(Math.abs(chart.ayanamsaValue - chart.nutationInLongitude - expected) * ARCSEC).toBeLessThan(TOLERANCE_ARCSEC);
    // UT of 00:30 at +8 is 16:30 on 31 Dec 1999. The previous civil year is one precession year away.
    const utYear = calculateAyanamsa(0, 'kp_straight_line', 0, { ...localNewYear, year: 1999 }).meanAyanamsa;
    expect(Math.abs(expected - utYear) * ARCSEC).toBeCloseTo(50.2388475, 6);
  });

  it('KP Ayanamsa is the same mean at one local clock under two offsets', () => {
    const clock = { year: 1992, month: 3, day: 11, hour: 6, minute: 14, second: 0, ...place };
    const options = {
      ayanamsa: 'kp_ayanamsa' as const,
      nodeAgentRuleSet: 'none' as const,
      rulingPlanetSet: 'asc_star_sign_moon_star_sign_day_lord' as const,
    };
    const plus8 = calculateChart({ ...clock, utcOffsetHours: 8 }, options);
    const utc = calculateChart({ ...clock, utcOffsetHours: 0 }, options);
    const mean8 = plus8.ayanamsaValue - plus8.nutationInLongitude;
    const mean0 = utc.ayanamsaValue - utc.nutationInLongitude;
    expect(Math.abs(mean8 - 23.657813848801) * ARCSEC).toBeLessThan(TOLERANCE_ARCSEC);
    expect(Math.abs(mean8 - mean0) * ARCSEC).toBeLessThan(TOLERANCE_ARCSEC);
    expect(plus8.ayanamsaType).toBe('kp_ayanamsa');
    expect(plus8.ayanamsaName).toBe('KP Ayanamsa');
  });
});

describe('the new ids are selectable; KP New stays the preselect', () => {
  it('GET /api/ayanamsa returns both, and the page lists them with KP New selected', async () => {
    expect(DEFAULT_AYANAMSA_SELECTION).toBe('kp_new');
    expect(AYANAMSA_MODES).toContain('kp_straight_line');
    expect(AYANAMSA_MODES).toContain('kp_ayanamsa');
    expect(AYANAMSA_LABELS.kp_straight_line).toBe('KP Straight Line');
    expect(AYANAMSA_LABELS.kp_ayanamsa).toBe('KP Ayanamsa');

    const json = (await (await app.request('/api/ayanamsa?date=1992-03-11T06:14:00Z')).json()) as {
      ayanamsas: { id: string; meanDegrees: number; trueDegrees: number }[];
      defaultSelection: string;
      nutationInLongitudeDegrees: number;
    };
    expect(json.defaultSelection).toBe('kp_new');
    const ayan = json.ayanamsas.find((row) => row.id === 'kp_ayanamsa')!;
    const line = json.ayanamsas.find((row) => row.id === 'kp_straight_line')!;
    expect(Math.abs(ayan.meanDegrees - 23.657813848801) * ARCSEC).toBeLessThan(TOLERANCE_ARCSEC);
    expect(Math.abs(line.meanDegrees - 23.73785544375) * ARCSEC).toBeLessThan(TOLERANCE_ARCSEC);
    expect(ayan.trueDegrees - ayan.meanDegrees).toBeCloseTo(json.nutationInLongitudeDegrees, 10);

    const select =
      indexHtml.match(/<(select|md-(?:outlined|filled)-select)\b[^>]*id="inpAyanamsa"[\s\S]*?<\/\1>/)?.[0] ?? '';
    expect(select).toContain('value="kp_straight_line"');
    expect(select).toContain('value="kp_ayanamsa"');
    const selected = [...select.matchAll(/<(?:option|md-select-option) value="([^"]+)"[^>]*\sselected/g)].map((m) => m[1]);
    expect(selected).toEqual(['kp_new']);
  });
});
