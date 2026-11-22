import { describe, it, expect, vi } from 'vitest';
import app from '../src/index.js';
import { AYANAMSA_MODES } from '../src/engine/ayanamsa-defs.js';
import { getHoraryEntry } from '../src/engine/kp-lords.js';
import { NODE_AGENT_RULE_SET_DESCRIPTIONS } from '../src/engine/significators.js';

/**
 * Hono API routes (work package `entrypoint`, #66).
 *
 * `test/worker.test.ts` (Stack B's plain fetch handler) was folded into this file; where each of its
 * cases went is listed in the "folded from worker.test.ts" describe blocks below.
 *
 * Reference values: docs/build-fix/audit.md Appendix A (Swiss Ephemeris 2.10.03). KL 1992 is A.1:
 * Sun 326.9440666 (KP Old) / 326.9239411 (KP New), tolerance 2 arcsec (the Sun tolerance of
 * `chart-reference.test.ts`); the Lahiri Sun, 326.8472142, is from `ayanamsa-reference.test.ts`.
 */

const post = (path: string, body: unknown) =>
  app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

/** KL 1992-03-11 06:14 +08:00 (Appendix A.1). */
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

/** Tromso 2010-12-21 03:00 UTC (Appendix A.5): inside the polar circle, polar night. */
const TROMSO_2010 = {
  year: 2010,
  month: 12,
  day: 21,
  hour: 3,
  minute: 0,
  second: 0,
  utcOffsetHours: 0,
  latitude: 69.6492,
  longitude: 18.9553,
};

const ARCSEC = 1 / 3600;

describe('KP-Web API Routes', () => {
  it('GET /api/health returns ok status', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.status).toBe('ok');
    expect(json.timestamp).toBeDefined();
  });

  it('GET /api/chart/sample returns sample charts', async () => {
    const res = await app.request('/api/chart/sample');
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.samples).toBeDefined();
    expect(json.samples.length).toBeGreaterThan(0);
    expect(json.samples[0].id).toBe('india-independence');
  });

  it('POST /api/chart/cusps computes Placidus cusps', async () => {
    const payload = {
      year: 1947,
      month: 8,
      day: 14,
      hour: 18,
      minute: 30,
      second: 0,
      latitude: 28.6139,
      longitude: 77.209,
      ayanamsa: 'kp_old',
    };

    const res = await app.request('/api/chart/cusps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.success).toBe(true);
    expect(json.data.cusps).toHaveLength(12);
    // Ascendant in Taurus (~37.83°)
    expect(json.data.cusps[0].longitude).toBeCloseTo(37.829, 2);
    expect(json.data.cusps[0].signLord).toBe('Venus');
    expect(json.data.ayanamsaType).toBe('kp_old');
  });

  it('POST /api/chart/calculate computes full chart with planet house assignments and significators', async () => {
    const payload = {
      year: 1947,
      month: 8,
      day: 14,
      hour: 18,
      minute: 30,
      second: 0,
      latitude: 28.6139,
      longitude: 77.209,
      ayanamsa: 'kp_old',
      planets: [
        { name: 'Sun', longitude: 118.0 },
        { name: 'Moon', longitude: 84.0 },
      ],
    };

    const res = await app.request('/api/chart/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.success).toBe(true);
    expect(json.data.planets).toHaveLength(2);
    expect(json.data.significators).toBeDefined();
    expect(json.data.chartWheels).toBeDefined();
  });

  it('GET /api/horary/table returns 249 horary numbers', async () => {
    const res = await app.request('/api/horary/table');
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.success).toBe(true);
    expect(json.count).toBe(249);
    expect(json.table[107].number).toBe(108);
  });
});

describe('UI contract: /api/chart/* (legacy payload; the page now also sends utcOffsetHours)', () => {
  /** Historical page payload: no utcOffsetHours, pasted planet longitudes. The page no longer builds this. */
  const UI_PAYLOAD = {
    year: 1947,
    month: 8,
    day: 14,
    hour: 18,
    minute: 30,
    second: 0,
    latitude: 28.6139,
    longitude: 77.209,
    ayanamsa: 'kp_old',
    planets: [
      { name: 'Sun', longitude: 118.0 },
      { name: 'Moon', longitude: 84.0 },
    ],
  };

  it('the UI payload gets 200 and { success: true, data } with the fields it already had', async () => {
    const res = await post('/api/chart/calculate', UI_PAYLOAD);
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.success).toBe(true);
    for (const key of ['julianDateUT', 'armc', 'cusps', 'planets', 'significators', 'chartWheels', 'ayanamsaType']) {
      expect(json.data, key).toHaveProperty(key);
    }
    expect(json.data.cusps).toHaveLength(12);
    expect(json.data.planets[0]).toMatchObject({ name: 'Sun' });
  });

  it('the sample route returns inputs only: the invented "verified" planet longitudes are gone', async () => {
    const res = await app.request('/api/chart/sample');
    const json = (await res.json()) as any;
    expect(json.samples.map((x: any) => x.id)).toEqual(['india-independence', 'chennai-sample']);
    for (const sample of json.samples) {
      expect(sample).not.toHaveProperty('planets');
      expect(sample.input.ayanamsa).toBe('kp_old');
    }
  });

  it('a missing utcOffsetHours is treated as UTC on these two routes (TODO(#29 Q10))', async () => {
    const withZero = await (await post('/api/chart/cusps', { ...UI_PAYLOAD, planets: undefined, utcOffsetHours: 0 })).json();
    const without = await (await post('/api/chart/cusps', { ...UI_PAYLOAD, planets: undefined })).json();
    expect((without as any).data.cusps).toEqual((withZero as any).data.cusps);
    expect((without as any).data.julianDateUT).toBe((withZero as any).data.julianDateUT);
  });

  it.each(['/api/chart/cusps', '/api/chart/calculate'])('%s: Tromso (polar) is 200 with Porphyry cusps and a warning, not 500', async (path) => {
    const res = await post(path, { ...TROMSO_2010, ayanamsa: 'kp_old' });
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.success).toBe(true);
    expect(json.data.isPolarFallback).toBe(true);
    expect(json.data.cusps).toHaveLength(12);
    const polar = json.data.warnings.filter((w: any) => w.code === 'polar_fallback');
    expect(polar).toHaveLength(1);
    expect(polar[0].message).toMatch(/Porphyry/);
  });

  it('a non-polar chart has isPolarFallback false', async () => {
    const json = (await (await post('/api/chart/calculate', UI_PAYLOAD)).json()) as any;
    expect(json.data.isPolarFallback).toBe(false);
  });
});

describe('ayanamsa is required and validated, no default and no fallback (#22 decided)', () => {
  const ROUTES: Array<[string, Record<string, unknown>]> = [
    ['/api/chart/cusps', { ...KL_1992 }],
    ['/api/chart/calculate', { ...KL_1992 }],
    ['/api/calculate', { ...KL_1992 }],
    ['/api/horary', { ...KL_1992, horaryNumber: 108 }],
  ];

  for (const [path, base] of ROUTES) {
    it(`${path}: a missing ayanamsa is 400`, async () => {
      const res = await post(path, base);
      expect(res.status).toBe(400);
      const json = (await res.json()) as any;
      expect(json.error).toMatch(/ayanamsa/i);
    });

    it(`${path}: unknown ids are 400 (near-misses of the supported ones, never KP Old)`, async () => {
      for (const bad of ['lahiri2', 'Lahiri', 'KP_OLD', 'kp-old', '', 'default', null, 5]) {
        const res = await post(path, { ...base, ayanamsa: bad });
        expect(res.status, String(bad)).toBe(400);
      }
    });
  }

  it('the legacy routes carry success: false, the new ones { error } only', async () => {
    const legacy = (await (await post('/api/chart/calculate', KL_1992)).json()) as any;
    expect(legacy.success).toBe(false);
    expect(typeof legacy.error).toBe('string');
    const fresh = (await (await post('/api/calculate', KL_1992)).json()) as any;
    expect(fresh).not.toHaveProperty('success');
    expect(typeof fresh.error).toBe('string');
  });

  it.each(['kp_old', 'kp_new', 'lahiri', 'raman', 'fagan_bradley', 'yukteshwar', 'jn_bhasin', 'usha_shashi', 'nil'])(
    '/api/chart/calculate and /api/calculate accept %s and echo it back',
    async (id) => {
      const legacy = (await (await post('/api/chart/calculate', { ...KL_1992, ayanamsa: id })).json()) as any;
      expect(legacy.success).toBe(true);
      expect(legacy.data.ayanamsaType).toBe(id);
      const fresh = await post('/api/calculate', { ...KL_1992, ayanamsa: id });
      expect(fresh.status).toBe(200);
      expect(((await fresh.json()) as any).ayanamsaType).toBe(id);
    }
  );

  // #60 (owner, #29): every supported mode is accepted on every birth and horary route.
  it.each(AYANAMSA_MODES)('every route accepts %s (birth and horary) and echoes it back', async (id) => {
    for (const [path, base] of ROUTES) {
      const res = await post(path, { ...base, ayanamsa: id });
      expect(res.status, `${path} ${id}`).toBe(200);
      const json = (await res.json()) as any;
      expect(json.data?.ayanamsaType ?? json.ayanamsaType, `${path} ${id}`).toBe(id);
    }
  });

  it('kp_new and lahiri are not silently KP Old: the ayanamsa value and the Sun differ', async () => {
    const chart = async (ayanamsa: string) =>
      (await (await post('/api/calculate', { ...KL_1992, ayanamsa })).json()) as any;
    const old = await chart('kp_old');
    const nw = await chart('kp_new');
    const lahiri = await chart('lahiri');
    // KP New - KP Old = 72.44 to 72.46 arcsec (audit.md, ephemeris-reference.test.ts).
    expect(Math.abs((nw.ayanamsaValue - old.ayanamsaValue) * 3600 - 72.45)).toBeLessThan(0.1);
    expect(lahiri.ayanamsaValue).not.toBeCloseTo(old.ayanamsaValue, 2);
    const sun = (c: any) => c.planets.find((p: any) => p.name === 'Sun').longitude as number;
    expect(Math.abs(sun(old) - 326.9440666)).toBeLessThan(2 * ARCSEC); // A.1, KP Old
    expect(Math.abs(sun(nw) - 326.9239411)).toBeLessThan(2 * ARCSEC); // A.1, KP New
    expect(Math.abs(sun(lahiri) - 326.8471034)).toBeLessThan(2 * ARCSEC); // moved 0.399" from the old SE pin 326.8472142 when Lahiri became KP-Qt's precession
  });
});

describe('input validation', () => {
  it.each(['/api/chart/cusps', '/api/chart/calculate', '/api/calculate', '/api/horary'])(
    '%s: invalid JSON, a non-object body and impossible values are 400',
    async (path) => {
      const bad = await app.request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{nope' });
      expect(bad.status).toBe(400);
      expect(((await bad.json()) as any).error).toMatch(/JSON/);
      expect((await post(path, [1, 2])).status).toBe(400);

      const base = { ...KL_1992, ayanamsa: 'kp_old', horaryNumber: 108 };
      for (const patch of [
        { month: 2, day: 30 },
        { month: 13 },
        { hour: 24 },
        { latitude: 91 },
        { longitude: -181 },
        { year: 'abc' },
        { minute: null },
        { utcOffsetHours: 99 },
      ]) {
        expect((await post(path, { ...base, ...patch })).status, JSON.stringify(patch)).toBe(400);
      }
    }
  );

  it('/api/chart/*: planets must be an array of { name, longitude }', async () => {
    const base = { ...KL_1992, ayanamsa: 'kp_old' };
    expect((await post('/api/chart/calculate', { ...base, planets: 'Sun' })).status).toBe(400);
    expect((await post('/api/chart/calculate', { ...base, planets: [{ name: 'Sun' }] })).status).toBe(400);
  });

  it('an unknown route is a JSON 404', async () => {
    const res = await app.request('/api/nope');
    expect(res.status).toBe(404);
    expect(((await res.json()) as any).error).toMatch(/not found/i);
  });
});

describe('POST /api/calculate (natal chart on calculateChart)', () => {
  it('KL 1992: Sun within 2 arcsec of A.1, day lord Mars (#36), running bhukti Rahu (#37)', async () => {
    const res = await post('/api/calculate', { ...KL_1992, ayanamsa: 'kp_old' });
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;

    const sun = json.planets.find((p: any) => p.name === 'Sun');
    expect(Math.abs(sun.longitude - 326.9440666)).toBeLessThan(2 * ARCSEC);
    expect(sun.signLord).toBe('Saturn');
    expect(sun.starLord).toBe('Jupiter');
    expect(sun.subLord).toBe('Venus');

    // A.7: the chart is before sunrise (06:14 local), so the day lord is Mars, not Mercury (#36).
    expect(json.rulingPlanets.dayLord).toBe('Mars');
    // A.7: running bhukti of the Moon dasha is Rahu, with the bhuktis already elapsed dropped (#37).
    expect(json.dashaBalance.dashaLord).toBe('Moon');
    expect(json.dashaBalance.dashaTimeline[0].subPeriods[0].lord).toBe('Rahu');

    // Placidus cusp 1 of A.1.
    expect(Math.abs(json.cusps[0].longitude - 307.7290202)).toBeLessThan(0.5 * ARCSEC);
    expect(json.isPolarFallback).toBe(false);
  });

  it('applies ENGINE_CONFIG: node agents "none" (TODO(#23)) and the 5-entry ruling list (TODO(#24))', async () => {
    const json = (await (await post('/api/calculate', { ...KL_1992, ayanamsa: 'kp_old' })).json()) as any;
    expect(json.nodeAgentSignificators.rahuKetuRules).toBe(NODE_AGENT_RULE_SET_DESCRIPTIONS.none);
    expect(json.nodeAgentSignificators.planetWise.Rahu.agentsFor).toEqual([]);
    expect(json.nodeAgentSignificators.planetWise.Ketu.agentsFor).toEqual([]);
    const rp = json.rulingPlanets;
    expect(rp.rulingPlanetsList).toEqual([
      rp.ascendantStarLord,
      rp.ascendantSignLord,
      rp.moonStarLord,
      rp.moonSignLord,
      rp.dayLord,
    ]);
  });

  it('a missing utcOffsetHours is 400: no silent UTC', async () => {
    const { utcOffsetHours: _omit, ...noOffset } = KL_1992;
    const res = await post('/api/calculate', { ...noOffset, ayanamsa: 'kp_old' });
    expect(res.status).toBe(400);
    expect(((await res.json()) as any).error).toMatch(/utcOffsetHours/);
  });

  it('second is optional (0); every other field is required', async () => {
    const { second: _s, ...noSecond } = KL_1992;
    expect((await post('/api/calculate', { ...noSecond, ayanamsa: 'kp_old' })).status).toBe(200);
    for (const key of ['year', 'month', 'day', 'hour', 'minute', 'latitude', 'longitude'] as const) {
      const body: Record<string, unknown> = { ...KL_1992, ayanamsa: 'kp_old' };
      delete body[key];
      expect((await post('/api/calculate', body)).status, key).toBe(400);
    }
  });

  it('Tromso (polar night): 200, Porphyry fallback with its warning, no day lord', async () => {
    const res = await post('/api/calculate', { ...TROMSO_2010, ayanamsa: 'kp_old' });
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.isPolarFallback).toBe(true);
    expect(json.warnings.filter((w: any) => w.code === 'polar_fallback')).toHaveLength(1);
    expect(json.rulingPlanets.dayLord).toBeNull();
    expect(json.warnings.some((w: any) => w.code === 'no_sunrise')).toBe(true);
  });

  it('folded from worker.test.ts "POST /api/calculate computes natal chart" (1990-05-15, Chennai)', async () => {
    // Stack B asserted planets.length 12, houses.length 12 and a truthy ascendant.signName.
    // Now: 9 planets (owner answer 11 on #29: outer planets omitted), `cusps` (was `houses`), cusps[0].signName.
    const res = await post('/api/calculate', {
      year: 1990, month: 5, day: 15, hour: 14, minute: 30, second: 0,
      utcOffsetHours: 0, latitude: 13.0827, longitude: 80.2707, ayanamsa: 'kp_old',
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.planets.length).toBe(9);
    expect(json.cusps.length).toBe(12);
    expect(json.cusps[0].signName).toBeTruthy();
  });
});

describe('POST /api/horary (horary chart on calculateHoraryChart)', () => {
  /** The question: 2026-11-21 06:00 UTC at Chennai, as in `test/horary.test.ts`. */
  const QUESTION = {
    year: 2026, month: 11, day: 21, hour: 6, minute: 0, second: 0,
    utcOffsetHours: 0, latitude: 13.0827, longitude: 80.2707, ayanamsa: 'kp_old',
  };

  it('number 108: the lagna is the START of the sub, 153.0 deg (Virgo, Saturn sub)', async () => {
    const res = await post('/api/horary', { ...QUESTION, horaryNumber: 108 });
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.horaryNumber).toBe(108);
    expect(json.useSubMidpoint).toBe(false);
    expect(Math.abs(json.lagnaTargetDeg - 153.0)).toBeLessThan(1e-10);
    // Same tolerance as test/horary.test.ts: 1e-6 deg = 0.0036 arcsec.
    expect(Math.abs(json.cusps[0].longitude - 153.0)).toBeLessThan(1e-6);
    expect(json.cusps[0].signName).toBe('Virgo');
    expect(json.cusps[0].subLord).toBe('Saturn');
  });

  it('useSubMidpoint: true puts the lagna at the midpoint of the sub; false is the same as omitting it', async () => {
    const entry = getHoraryEntry(108);
    const mid = (entry.startLongitude + entry.endLongitude) / 2;
    const midChart = (await (await post('/api/horary', { ...QUESTION, horaryNumber: 108, useSubMidpoint: true })).json()) as any;
    expect(midChart.useSubMidpoint).toBe(true);
    expect(Math.abs(midChart.lagnaTargetDeg - mid)).toBeLessThan(1e-10);
    expect(Math.abs(midChart.cusps[0].longitude - mid)).toBeLessThan(1e-6);
    expect(mid).toBeGreaterThan(entry.startLongitude);

    const explicit = (await (await post('/api/horary', { ...QUESTION, horaryNumber: 108, useSubMidpoint: false })).json()) as any;
    const omitted = (await (await post('/api/horary', { ...QUESTION, horaryNumber: 108 })).json()) as any;
    expect(explicit.lagnaTargetDeg).toBe(omitted.lagnaTargetDeg);
    expect(omitted.lagnaTargetDeg).toBe(entry.startLongitude);
  });

  it('horaryNumber outside 1..249, fractional or not a number is 400; 1 and 249 are accepted', async () => {
    for (const bad of [0, 250, -1, 1.5, '108', null, undefined, Number.NaN]) {
      const res = await post('/api/horary', { ...QUESTION, horaryNumber: bad });
      expect(res.status, String(bad)).toBe(400);
      expect(((await res.json()) as any).error).toMatch(/horaryNumber/);
    }
    expect((await post('/api/horary', { ...QUESTION, horaryNumber: 1 })).status).toBe(200);
    expect((await post('/api/horary', { ...QUESTION, horaryNumber: 249 })).status).toBe(200);
  });

  it('useSubMidpoint must be a boolean when given', async () => {
    const res = await post('/api/horary', { ...QUESTION, horaryNumber: 108, useSubMidpoint: 'yes' });
    expect(res.status).toBe(400);
  });

  it('the question time and place are required: no "now" and no silent UTC', async () => {
    const { utcOffsetHours: _o, ...noOffset } = QUESTION;
    expect((await post('/api/horary', { ...noOffset, horaryNumber: 108 })).status).toBe(400);
    const { year: _y, ...noYear } = QUESTION;
    expect((await post('/api/horary', { ...noYear, horaryNumber: 108 })).status).toBe(400);
  });

  it('a polar latitude is 422 (the Ascendant to ARMC inversion is not unique there, #58)', async () => {
    const res = await post('/api/horary', { ...TROMSO_2010, ayanamsa: 'kp_old', horaryNumber: 108 });
    expect(res.status).toBe(422);
    const json = (await res.json()) as any;
    expect(json.error).toMatch(/polar|latitude/i);
    expect(json).not.toHaveProperty('stack');
  });
});

describe('GET /api/ayanamsa', () => {
  it('lists the supported ids with labels; defaultSelection is the UI preselect only', async () => {
    const res = await app.request('/api/ayanamsa?date=2026-11-21T06:00:00Z');
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.ayanamsas.map((a: any) => a.id)).toEqual([
      'kp_straight_line_adjusted', 'kp_straight_line', 'kp_ayanamsa', 'kp_old', 'kp_new', 'lahiri', 'raman', 'fagan_bradley', 'yukteshwar', 'jn_bhasin', 'usha_shashi', 'nil',
    ]);
    expect(json.ayanamsas.map((a: any) => a.label)).toContain('Lahiri');
    expect(json).not.toHaveProperty('default');
    expect(json.defaultSelection).toBe('kp_new');
    expect(json.dateUtc).toBe('2026-11-21T06:00:00.000Z');
    const nil = json.ayanamsas.find((a: any) => a.id === 'nil');
    expect(nil.meanDegrees).toBe(0);
    expect(nil.trueDegrees).toBe(0);
  });

  it('folded from worker.test.ts: KP Old and KP New values (> 24.1 deg, difference 72.44 +/- 0.1 arcsec)', async () => {
    const json = (await (await app.request('/api/ayanamsa?date=2026-11-21T06:00:00Z')).json()) as any;
    const kpOld = json.ayanamsas.find((a: any) => a.id === 'kp_old');
    const kpNew = json.ayanamsas.find((a: any) => a.id === 'kp_new');
    expect(kpOld.meanDegrees > 24.1).toBe(true);
    expect(kpNew.meanDegrees > 24.1).toBe(true);
    expect(Math.abs((kpNew.meanDegrees - kpOld.meanDegrees) * 3600 - 72.44) < 0.1).toBe(true);
    expect(kpOld.meanDms).toMatch(/^24°\d\d'\d\d\.\d\d"$/);
  });

  it('matches the Swiss Ephemeris reference values of ayanamsa.test.ts within 0.1 arcsec (2026-11-21 00:00 UT)', async () => {
    const json = (await (await app.request('/api/ayanamsa?date=2026-11-21T00:00:00Z')).json()) as any;
    const mean = (id: string) => json.ayanamsas.find((a: any) => a.id === id).meanDegrees as number;
    expect(Math.abs(mean('kp_old') - 24.135844) * 3600).toBeLessThan(0.1);
    expect(Math.abs(mean('kp_new') - 24.155968) * 3600).toBeLessThan(0.1);
  });

  it('a true ayanamsa is the mean plus the nutation in longitude (KPSTLA: true = mean, no nutation, #29)', async () => {
    const json = (await (await app.request('/api/ayanamsa?date=2000-01-01T12:00:00Z')).json()) as any;
    for (const a of json.ayanamsas.filter((x: any) => x.id !== 'nil' && x.id !== 'kp_straight_line_adjusted')) {
      expect(a.trueDegrees - a.meanDegrees).toBeCloseTo(json.nutationInLongitudeDegrees, 10);
    }
    const stla = json.ayanamsas.find((x: any) => x.id === 'kp_straight_line_adjusted');
    expect(stla.trueDegrees).toBe(stla.meanDegrees);
  });

  it('an invalid date is 400', async () => {
    expect((await app.request('/api/ayanamsa?date=not-a-date')).status).toBe(400);
  });
});

describe('GET /api/horary-table', () => {
  it('folded from worker.test.ts: the full table, and entry 108 (Virgo, Saturn)', async () => {
    const all = await app.request('/api/horary-table');
    expect(all.status).toBe(200);
    expect(((await all.json()) as any[]).length).toBe(249);

    const one = await app.request('/api/horary-table?number=108');
    expect(one.status).toBe(200);
    const entry = (await one.json()) as any;
    // Stack B's field names were horaryNumber / signName / subLord; the unified entry has `number`.
    expect(entry.number).toBe(108);
    expect(entry.signName).toBe('Virgo');
    expect(entry.subLord).toBe('Saturn');
    expect(entry.startLongitude).toBe(153.0);
  });

  it('?number= out of range, fractional or not a number is 400', async () => {
    for (const bad of ['0', '250', '-1', '1.5', 'abc', '']) {
      expect((await app.request(`/api/horary-table?number=${bad}`)).status, bad).toBe(400);
    }
    expect((await app.request('/api/horary-table?number=1')).status).toBe(200);
    expect((await app.request('/api/horary-table?number=249')).status).toBe(200);
  });
});

describe('GET /api/health (folded from worker.test.ts)', () => {
  it('reports status, engine, the supported ayanamsas and the UI default selection', async () => {
    const res = await app.request('/api/health');
    const json = (await res.json()) as any;
    expect(json.status).toBe('ok');
    expect(json.timestamp).toBeDefined();
    expect(json.service).toBe('KP-Web');
    expect(json.engine).toBe('astronomy-engine');
    expect(String(json.runtime)).toContain('Cloudflare Workers');
    expect(json.ayanamsas).toHaveLength(12);
    expect(json.defaultSelection).toBe('kp_new');
    expect(json).not.toHaveProperty('defaultAyanamsa');
    expect(json.endpoints).toContain('POST /api/horary');
  });
});

describe('CORS (folded from worker.test.ts "OPTIONS preflight returns CORS headers")', () => {
  it('a preflight gets the CORS headers (Hono answers 204; the Stack B worker answered 200)', async () => {
    const res = await app.request('/api/calculate', {
      method: 'OPTIONS',
      headers: { Origin: 'https://example.com', 'Access-Control-Request-Method': 'POST' },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
  });

  it('responses carry Access-Control-Allow-Origin', async () => {
    const res = await app.request('/api/health');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});

describe("errors that are not the caller's fault are 500 without a stack trace", () => {
  it('an unexpected engine exception returns a generic message, no stack and no internals', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.resetModules();
    vi.doMock('../src/engine/index.js', async (importOriginal) => ({
      ...(await importOriginal<Record<string, unknown>>()),
      calculateChart: () => {
        throw new Error('boom: secret internals');
      },
    }));
    try {
      const { default: broken } = await import('../src/index.js');
      const res = await broken.request('/api/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...KL_1992, ayanamsa: 'kp_old' }),
      });
      expect(res.status).toBe(500);
      const text = await res.text();
      expect(JSON.parse(text)).toEqual({ error: 'An internal error occurred while processing the request.' });
      expect(text).not.toMatch(/boom|secret|stack|\.ts:/);
      expect(spy).toHaveBeenCalled();
    } finally {
      vi.doUnmock('../src/engine/index.js');
      vi.resetModules();
      spy.mockRestore();
    }
  });
});
