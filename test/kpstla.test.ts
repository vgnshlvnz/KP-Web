/**
 * KP Straight Line (Adjusted), "KPSTLA" (id `kp_straight_line_adjusted`), work package add-kpstla (#72).
 *
 * The expected mean values below are FORMULA-DERIVED, NOT INDEPENDENT REFERENCES. They are the
 * orchestrator's reading of the owner's definition (#29, 2026-11-21: KPSTLA = T x P / 3600, P =
 * 50.2388475 arcsec/yr, base year 291 AD) with the provisional choices G1 (t0 = JD 1827345.5),
 * G2a (T in Julian years of 365.25 days) and G3a (true = mean + dPsi). The independent reference
 * check is deferred by the owner ("we will do the test and reference checks later. build first",
 * 2026-11-22). TODO(#29 G1), TODO(#29 G2), TODO(#29 G3): if the owner changes a choice, these values change.
 */
import { describe, it, expect } from 'vitest';
import app from '../src/index';
import { calculateAyanamsa, calculateNutation, toJulianDate } from '../src/engine/astronomy.js';
import {
  AYANAMSA_LABELS,
  AYANAMSA_MODES,
  DEFAULT_AYANAMSA_SELECTION,
  isAyanamsaMode,
} from '../src/engine/ayanamsa-defs.js';
import { validateAyanamsa } from '../src/core/validation';

const ID = 'kp_straight_line_adjusted' as const;

describe('KPSTLA mean ayanamsa (formula-derived, not independent references; TODO(#29 G1-G3))', () => {
  const CASES: Array<[string, number, number]> = [
    ['1900-01-01 0h UT', toJulianDate(1900, 1, 1, 0, 0, 0), 22.453506],
    ['1992-03-11 0h UT', toJulianDate(1992, 3, 11, 0, 0, 0), 23.740024],
    ['J2000.0', 2451545.0, 23.84901],
  ];

  it.each(CASES)('%s', (_label, jd, expected) => {
    expect(Math.abs(calculateAyanamsa(jd, ID).meanAyanamsa - expected)).toBeLessThan(1e-6);
  });

  it('true ayanamsa = mean + dPsi (G3a), as for every other mode', () => {
    for (const [, jd] of CASES) {
      const dPsi = calculateNutation(jd).dPsi;
      const a = calculateAyanamsa(jd, ID, dPsi);
      expect(a.trueAyanamsa - a.meanAyanamsa).toBeCloseTo(dPsi, 12);
      expect(dPsi).not.toBe(0);
      const kpOld = calculateAyanamsa(jd, 'kp_old', dPsi);
      expect(kpOld.trueAyanamsa - kpOld.meanAyanamsa).toBeCloseTo(dPsi, 12);
    }
  });
});

describe('KPSTLA id, label and default selection', () => {
  it('is a supported mode, accepted by validateAyanamsa, listed first, with its label', () => {
    expect(isAyanamsaMode(ID)).toBe(true);
    expect(validateAyanamsa(ID)).toBeNull();
    expect(AYANAMSA_MODES[0]).toBe(ID);
    expect(AYANAMSA_MODES).toHaveLength(10);
    expect(AYANAMSA_LABELS[ID]).toBe('KP Straight Line (Adjusted)');
  });

  it('DEFAULT_AYANAMSA_SELECTION is KPSTLA, and near-miss ids are still rejected', () => {
    expect(DEFAULT_AYANAMSA_SELECTION).toBe(ID);
    for (const bad of ['kpstla', 'KPSTLA', 'kp_straight_line', 'kp_straightline_adjusted', '']) {
      expect(isAyanamsaMode(bad), bad).toBe(false);
      expect(validateAyanamsa(bad), bad).toContain('no silent fallback');
    }
  });
});

describe('KPSTLA through the API: UI preselect only, never an API fallback (#22, G4a)', () => {
  const post = (path: string, body: unknown) =>
    app.request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  const KL_1992 = {
    year: 1992,
    month: 3,
    day: 11,
    hour: 6,
    minute: 14,
    second: 0,
    utcOffsetHours: 8,
    latitude: 3.139,
    longitude: 101.6869,
  };

  it('GET /api/health and GET /api/ayanamsa report defaultSelection', async () => {
    const health = (await (await app.request('/api/health')).json()) as any;
    expect(health.defaultSelection).toBe(ID);
    const list = (await (await app.request('/api/ayanamsa?date=1992-03-11T00:00:00Z')).json()) as any;
    expect(list.defaultSelection).toBe(ID);
    expect(list.ayanamsas[0].id).toBe(ID);
    expect(Math.abs(list.ayanamsas[0].meanDegrees - 23.740024)).toBeLessThan(1e-6);
  });

  for (const path of ['/api/chart/cusps', '/api/chart/calculate', '/api/calculate']) {
    it(`${path}: a missing ayanamsa is still 400 (no fallback to the default selection)`, async () => {
      const res = await post(path, KL_1992);
      expect(res.status).toBe(400);
      expect(((await res.json()) as any).error).toMatch(/ayanamsa/i);
    });
  }

  it('/api/calculate accepts the id, echoes it, and the Sun is sidereal = tropical - true ayanamsa', async () => {
    const res = await post('/api/calculate', { ...KL_1992, ayanamsa: ID });
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.ayanamsaType).toBe(ID);
    const old = (await (await post('/api/calculate', { ...KL_1992, ayanamsa: 'kp_old' })).json()) as any;
    const sun = (c: any) => c.planets.find((p: any) => p.name === 'Sun').longitude as number;
    // Tropical Sun is the same under both modes, so the sidereal difference is the ayanamsa difference.
    expect(sun(old) - sun(json)).toBeCloseTo(json.ayanamsaValue - old.ayanamsaValue, 6);
    expect(json.ayanamsaValue).not.toBeCloseTo(old.ayanamsaValue, 2);
  });
});
