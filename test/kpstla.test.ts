/**
 * KP Straight Line (Adjusted), "KPSTLA" (id `kp_straight_line_adjusted`), work package add-kpstla (#72).
 *
 * The expected mean values below are formula-derived; definition final (#29). They follow the owner's
 * definition (#29, 2026-11-21: KPSTLA = T x P / 3600, P = 50.2388475 arcsec/yr, base year 291 AD) with
 * G1 (t0 = JD 1827345.5), G2 (T in Julian years of 365.25 days) and G3 (no nutation: true = mean), all
 * decided (owner, #29, 2026-11-21 18:14Z / 2026-11-22 00:25Z): industry standard; no nutation.
 * There is no independent reference value for this mode (it has no Swiss Ephemeris definition).
 */
import { describe, it, expect } from 'vitest';
import indexHtml from '../public/index.html?raw';
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

describe('KPSTLA mean ayanamsa (formula-derived; definition final, #29)', () => {
  const CASES: Array<[string, number, number]> = [
    ['1900-01-01 0h UT', toJulianDate(1900, 1, 1, 0, 0, 0), 22.453506],
    ['1992-03-11 0h UT', toJulianDate(1992, 3, 11, 0, 0, 0), 23.740024],
    ['J2000.0', 2451545.0, 23.84901],
  ];

  it.each(CASES)('%s', (_label, jd, expected) => {
    expect(Math.abs(calculateAyanamsa(jd, ID).meanAyanamsa - expected)).toBeLessThan(1e-6);
  });

  it('true ayanamsa = mean (G3, no nutation, #29), while KP Old still adds dPsi', () => {
    for (const [, jd] of CASES) {
      const dPsi = calculateNutation(jd).dPsi;
      expect(dPsi).not.toBe(0);
      const a = calculateAyanamsa(jd, ID, dPsi);
      expect(a.trueAyanamsa).toBe(a.meanAyanamsa);
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
    expect(AYANAMSA_MODES).toHaveLength(12);
    expect(AYANAMSA_LABELS[ID]).toBe('KP Straight Line (Adjusted)');
  });

  it('DEFAULT_AYANAMSA_SELECTION is KP New (#22, #59), and near-miss ids are still rejected', () => {
    expect(DEFAULT_AYANAMSA_SELECTION).toBe('kp_new');
    expect(DEFAULT_AYANAMSA_SELECTION).not.toBe(ID);
    for (const bad of ['kpstla', 'KPSTLA', 'kp_straightline_adjusted', 'kp_straight', '']) {
      expect(isAyanamsaMode(bad), bad).toBe(false);
      expect(validateAyanamsa(bad), bad).toContain('no silent fallback');
    }
  });
});

describe('KPSTLA through the API; KP New is the UI default selection only, never an API fallback (#22 decided)', () => {
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
    expect(health.defaultSelection).toBe('kp_new');
    const list = (await (await app.request('/api/ayanamsa?date=1992-03-11T00:00:00Z')).json()) as any;
    expect(list.defaultSelection).toBe('kp_new');
    expect(list.ayanamsas[0].id).toBe(ID);
    expect(Math.abs(list.ayanamsas[0].meanDegrees - 23.740024)).toBeLessThan(1e-6);
    expect(list.ayanamsas[0].trueDegrees).toBe(list.ayanamsas[0].meanDegrees); // no nutation (#29)
  });

  for (const path of ['/api/chart/cusps', '/api/chart/calculate', '/api/calculate']) {
    it(`${path}: a missing ayanamsa is still 400 (no fallback to the default selection)`, async () => {
      const res = await post(path, KL_1992);
      expect(res.status).toBe(400);
      expect(((await res.json()) as any).error).toMatch(/ayanamsa/i);
    });
  }

  it('public/index.html preselects KP New and no other option', () => {
    // The page may use a native <select> or a Material Web <md-outlined-select> / <md-filled-select>.
    const select =
      indexHtml.match(/<(select|md-(?:outlined|filled)-select)\b[^>]*id="inpAyanamsa"[\s\S]*?<\/\1>/)?.[0] ?? '';
    const selected = [...select.matchAll(/<(?:option|md-select-option) value="([^"]+)"[^>]*\sselected/g)].map((m) => m[1]);
    expect(selected).toEqual(['kp_new']);
  });

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
