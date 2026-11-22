/**
 * POST /api/match (work package `horoscope-matching`, #100). The engine is tested in `matching.test.ts`.
 */
import { describe, it, expect } from 'vitest';
import app from '../src/index.js';
import type { DateTimeLocation } from '../src/engine/types.js';

const post = (path: string, body: unknown) =>
  app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

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

// ---------------------------------------------------------------------------
// Route: POST /api/match
// ---------------------------------------------------------------------------

describe('POST /api/match', () => {
  const validBody = () => ({
    ayanamsa: 'kp_new',
    boy: BOY_INPUT,
    girl: GIRL_INPUT,
    // Changed from the horoscope-match version: a girl given by coordinates now needs the offset at the
    // checking date (it is no longer copied from her birth offset).
    checkingDate: { year: 1986, month: 2, day: 1, utcOffsetHours: 8 },
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

// ---------------------------------------------------------------------------
// Places and offsets (work package `horoscope-matching`): locationId, the historical offset, and
// the checking instant in the girl's place as it was on the checking date.
// ---------------------------------------------------------------------------

const KUALA_LUMPUR = 1096; // Asia/Kuala_Lumpur: UTC+7:30 until 1982, UTC+8 after
const UK = 642; // Europe/London: UTC+0, UTC+1 in summer time

describe('POST /api/match: places and offsets', () => {
  const base = () => ({
    ayanamsa: 'kp_new',
    boy: { locationId: KUALA_LUMPUR, year: 1980, month: 9, day: 14, hour: 1, minute: 5, second: 0 },
    girl: { locationId: UK, year: 1990, month: 1, day: 15, hour: 12, minute: 0, second: 0 },
    checkingDate: { year: 2026, month: 7, day: 1 },
  });

  it('resolves locationId to coordinates and the offset in force at each birth', async () => {
    const res = await post('/api/match', base());
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.boy.location.id).toBe(KUALA_LUMPUR);
    expect(json.boy.location.utcOffsetHours).toBe(7.5); // Malaysia was UTC+7:30 in 1980
    expect(json.girl.location.utcOffsetHours).toBe(0); // London in January
  });

  it('a locationId person gives the same marks as the same person given by coordinates and that offset', async () => {
    const viaId = (await (await post('/api/match', base())).json()) as any;
    const kl = viaId.boy.location;
    const uk = viaId.girl.location;
    const viaCoords = (await (
      await post('/api/match', {
        ayanamsa: 'kp_new',
        boy: { year: 1980, month: 9, day: 14, hour: 1, minute: 5, second: 0, latitude: kl.latitude, longitude: kl.longitude, utcOffsetHours: 7.5 },
        girl: { year: 1990, month: 1, day: 15, hour: 12, minute: 0, second: 0, latitude: uk.latitude, longitude: uk.longitude, utcOffsetHours: 0 },
        checkingDate: { year: 2026, month: 7, day: 1, utcOffsetHours: 1 },
      })
    ).json()) as any;
    expect(viaCoords.rules).toEqual(viaId.rules);
    expect(viaCoords.total).toBe(viaId.total);
    expect(viaCoords.boy.location).toBeNull();
  });

  it('the checking instant is noon in the girl\'s zone ON THE CHECKING DATE, not at her birth (summer time)', async () => {
    // Born in January (UTC+0), checked in July (UTC+1): noon is 11:00 UTC. The horoscope-match branch
    // used her birth offset and would have said 12:00 UTC.
    const json = (await (await post('/api/match', base())).json()) as any;
    expect(json.checking).toEqual({ year: 2026, month: 7, day: 1, utcOffsetHours: 1, offsetSource: 'girl_location_at_checking_date' });
    expect(json.checkingUtc).toBe('2026-07-01T11:00:00.000Z');
  });

  it('and the other way round: born in summer time, checked in winter', async () => {
    const body = base();
    body.girl = { ...body.girl, month: 7 };
    body.checkingDate = { year: 2026, month: 1, day: 15 };
    const json = (await (await post('/api/match', body)).json()) as any;
    expect(json.girl.location.utcOffsetHours).toBe(1);
    expect(json.checking.utcOffsetHours).toBe(0);
    expect(json.checkingUtc).toBe('2026-01-15T12:00:00.000Z');
  });

  it('a girl given by coordinates must give the offset at the checking date (no copy of her birth offset)', async () => {
    const body = {
      ayanamsa: 'kp_new',
      boy: BOY_INPUT,
      girl: GIRL_INPUT,
      checkingDate: { year: 1986, month: 2, day: 1 },
    };
    const res = await post('/api/match', body);
    expect(res.status).toBe(400);
    expect(((await res.json()) as any).error ?? '').toMatch(/checkingDate\.utcOffsetHours/);
  });

  it('a girl given by coordinates: the given checking offset is used and reported as from the request', async () => {
    const json = (await (
      await post('/api/match', {
        ayanamsa: 'kp_new',
        boy: BOY_INPUT,
        girl: GIRL_INPUT,
        checkingDate: { year: 1986, month: 2, day: 1, utcOffsetHours: 5.5 },
      })
    ).json()) as any;
    expect(json.checking.offsetSource).toBe('request');
    expect(json.checkingUtc).toBe('1986-02-01T06:30:00.000Z');
  });

  it('400s when checkingDate.utcOffsetHours is sent for a girl given by locationId', async () => {
    const body = base();
    body.checkingDate = { ...body.checkingDate, utcOffsetHours: 1 } as any;
    expect((await post('/api/match', body)).status).toBe(400);
  });

  it('400s on a birth time in a DST gap (London 2026-03-29 01:30 does not exist)', async () => {
    const body = base();
    body.boy = { locationId: UK, year: 2026, month: 3, day: 29, hour: 1, minute: 30, second: 0 };
    expect((await post('/api/match', body)).status).toBe(400);
  });

  it('400s on a birth time in a DST overlap without ambiguousTime, and accepts it with one', async () => {
    const body = base();
    body.boy = { locationId: UK, year: 2025, month: 10, day: 26, hour: 1, minute: 30, second: 0 };
    expect((await post('/api/match', body)).status).toBe(400);
    for (const [choice, offset] of [['earlier', 1], ['later', 0]] as const) {
      const ok = (await post('/api/match', { ...body, boy: { ...body.boy, ambiguousTime: choice } }));
      expect(ok.status).toBe(200);
      expect(((await ok.json()) as any).boy.location.utcOffsetHours).toBe(offset);
    }
  });

  it('400s on an invalid ambiguousTime for the checking date', async () => {
    const body = base();
    body.checkingDate = { ...body.checkingDate, ambiguousTime: 'sometime' } as any;
    expect((await post('/api/match', body)).status).toBe(400);
  });

  it('400s on an unknown locationId', async () => {
    const body = base();
    body.girl = { ...body.girl, locationId: 999999 };
    expect((await post('/api/match', body)).status).toBe(400);
  });
});

describe('POST /api/match: request validation', () => {
  const valid = () => ({
    ayanamsa: 'kp_new',
    boy: BOY_INPUT,
    girl: GIRL_INPUT,
    checkingDate: { year: 2026, month: 11, day: 22, utcOffsetHours: 8 },
  });

  it('400s on an unknown ayanamsa and never falls back to another', async () => {
    const body = { ...valid(), ayanamsa: 'lahiri_typo' };
    expect((await post('/api/match', body)).status).toBe(400);
  });

  it('every supported ayanamsa is accepted when it is named (none is a default)', async () => {
    for (const ayanamsa of ['kp_old', 'kp_new', 'lahiri']) {
      expect((await post('/api/match', { ...valid(), ayanamsa })).status).toBe(200);
    }
  });

  it('400s on a person without a utcOffsetHours when not given by locationId (no silent UTC)', async () => {
    const body = valid() as any;
    body.boy = { ...BOY_INPUT };
    delete body.boy.utcOffsetHours;
    expect((await post('/api/match', body)).status).toBe(400);
  });

  it('400s on a checking date that is not a calendar date', async () => {
    const body = valid();
    body.checkingDate = { year: 2026, month: 2, day: 30, utcOffsetHours: 8 };
    expect((await post('/api/match', body)).status).toBe(400);
  });

  it('400s on a checking date before the first dasha period (not clamped to it)', async () => {
    const body = valid();
    body.checkingDate = { year: 1900, month: 1, day: 1, utcOffsetHours: 8 };
    expect((await post('/api/match', body)).status).toBe(400);
  });

  it('answers a checking date past the first 120-year cycle', async () => {
    const body = valid();
    body.checkingDate = { year: 2125, month: 6, day: 1, utcOffsetHours: 8 };
    expect((await post('/api/match', body)).status).toBe(200);
  });

  it('rule 4\'s orb is not a request field: the route uses MATCH_RULE4_ORB_DEG (7), an "aspectOrbDeg" in the body is ignored', async () => {
    // For this pair rule 4 is 50 at a 7 degree orb and 0 at an orb of 0 (see matching.test.ts).
    const person = (year: number, day: number, hour: number) => ({
      year, month: 3, day, hour, minute: 0, second: 0, utcOffsetHours: 8, latitude: 3.1, longitude: 101.7,
    });
    const body = { ...valid(), boy: person(1990, 1, 3), girl: person(1992, 14, 15) };
    const plain = (await (await post('/api/match', body)).json()) as any;
    const withOrb = (await (await post('/api/match', { ...body, aspectOrbDeg: 0 })).json()) as any;
    expect(plain.rules.find((r: any) => r.id === 4).marks).toBe(50);
    expect(withOrb.rules).toEqual(plain.rules);
  });

  it('GET /api/health lists POST /api/match', async () => {
    const json = (await (await app.request('/api/health')).json()) as any;
    expect(JSON.stringify(json)).toContain('POST /api/match');
  });
});
