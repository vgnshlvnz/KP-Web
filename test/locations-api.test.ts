import { describe, expect, it } from 'vitest';
import app from '../src/index.js';
import { LOCATIONS } from '../src/data/locations';

/**
 * `locationId` on the chart routes and `GET /api/locations` (work package `locations-select`, part of #12).
 *
 * Reference value: Swiss Ephemeris 2.10.03 via audit.md Appendix A.1, Kuala Lumpur 1992-03-11 06:14 +08:00,
 * Sun 326.9440666 (KP Old), tolerance 2 arcsec (the Sun tolerance of `chart-reference.test.ts`). The Sun does
 * not depend on the place, so this checks that the offset the server looks up for Malaysia in 1992 (+8) is
 * the one SE used. Row ids are from `src/data/locations.ts` (the .db ids): India | Delhi 916, India | Chennai
 * 919, Malaysia | Kuala Lumpur 1096, USA | New York 1398, USA | Arizona 1369.
 */

const post = (path: string, body: unknown) =>
  app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const ARCSEC = 1 / 3600;
const DELHI = 916;
const KL = 1096;
const NEW_YORK = 1398;

/** India | Delhi, 15 Aug 1947 00:00 IST = 14 Aug 1947 18:30 UT. */
const INDEPENDENCE = { year: 1947, month: 8, day: 15, hour: 0, minute: 0, second: 0, ayanamsa: 'kp_old' };
/** The same instant through the existing latitude / longitude / offset path, with Delhi's coordinates from the .db. */
const INDEPENDENCE_LEGACY = {
  ...INDEPENDENCE,
  latitude: 28.613939,
  longitude: 77.209021,
  utcOffsetHours: 5.5,
};

describe('GET /api/locations', () => {
  it('returns every row grouped by country, with id, place, coordinates and zone', async () => {
    const res = await app.request('/api/locations');
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.count).toBe(722);
    expect(json.countries).toHaveLength(116);
    expect(json.countries.reduce((n: number, c: any) => n + c.places.length, 0)).toBe(722);
    const names = json.countries.map((c: any) => c.country);
    expect(names).toEqual([...names].sort((a: string, b: string) => a.localeCompare(b, 'en')));
    const india = json.countries.find((c: any) => c.country === 'India');
    expect(india.places).toHaveLength(22);
    expect(india.places[0]).toMatchObject({ id: 191, country: 'India', place: null });
    expect(india.places.find((p: any) => p.id === DELHI)).toEqual({
      id: 916,
      country: 'India',
      place: 'Delhi',
      latitude: 28.613939,
      longitude: 77.209021,
      timezone: 'Asia/Kolkata',
    });
  });

  it('is listed by /api/health', async () => {
    const json = (await (await app.request('/api/health')).json()) as any;
    expect(json.endpoints).toContain('GET  /api/locations');
  });
});

describe.each([
  ['/api/calculate', ({ location: _location, ...chart }: any) => chart],
  ['/api/chart/calculate', (json: any) => json.data],
  ['/api/chart/cusps', (json: any) => json.data],
] as const)('%s with locationId', (path, chartOf) => {
  it('is the same chart as the existing path given the same numbers, and returns the resolved location', async () => {
    const withId = (await (await post(path, { ...INDEPENDENCE, locationId: DELHI })).json()) as any;
    const legacy = (await (await post(path, INDEPENDENCE_LEGACY)).json()) as any;
    expect(chartOf(withId)).toEqual(chartOf(legacy));
    expect(legacy.location).toBeUndefined(); // the existing path has no `location`
    expect(withId.location).toEqual({
      id: 916,
      country: 'India',
      place: 'Delhi',
      latitude: 28.613939,
      longitude: 77.209021,
      timezone: 'Asia/Kolkata',
      utcOffsetHours: 5.5,
      preIanaReliableCaution: true,
    });
  });

  it('400 when locationId is combined with latitude, longitude or utcOffsetHours', async () => {
    for (const extra of [{ latitude: 28.6 }, { longitude: 77.2 }, { utcOffsetHours: 5.5 }, { utcOffsetHours: 0 }]) {
      const res = await post(path, { ...INDEPENDENCE, locationId: DELHI, ...extra });
      expect(res.status, JSON.stringify(extra)).toBe(400);
      expect(((await res.json()) as any).error).toContain('locationId');
    }
  });

  it('400 for an unknown or malformed locationId', async () => {
    for (const locationId of [0, 99999, -1, 1.5, '916', null, true, 'Delhi']) {
      const res = await post(path, { ...INDEPENDENCE, locationId });
      expect(res.status, JSON.stringify(locationId)).toBe(400);
      expect(((await res.json()) as any).error).toContain('locationId');
    }
  });

  it('400 with a DST gap, naming the zone, and never a chart', async () => {
    const res = await post(path, { ...INDEPENDENCE, year: 2024, month: 3, day: 10, hour: 2, minute: 30, locationId: NEW_YORK });
    expect(res.status).toBe(400);
    const json = (await res.json()) as any;
    expect(json.error).toContain('does not exist in timezone "America/New_York"');
    expect(json.location).toBeUndefined();
  });

  it('400 with a repeated hour and no choice; "earlier" and "later" give the two offsets; a bad choice is 400', async () => {
    const repeated = { ...INDEPENDENCE, year: 2024, month: 11, day: 3, hour: 1, minute: 30, locationId: NEW_YORK };
    const ask = await post(path, repeated);
    expect(ask.status).toBe(400);
    expect(((await ask.json()) as any).error).toContain('occurs twice');

    const earlier = (await (await post(path, { ...repeated, ambiguousTime: 'earlier' })).json()) as any;
    const later = (await (await post(path, { ...repeated, ambiguousTime: 'later' })).json()) as any;
    expect(earlier.location.utcOffsetHours).toBe(-4);
    expect(later.location.utcOffsetHours).toBe(-5);
    expect(earlier.location.preIanaReliableCaution).toBe(false);
    // One hour apart in UT.
    const jd = (j: any) => chartOf(j).julianDateUT as number;
    expect(jd(later) - jd(earlier)).toBeCloseTo(1 / 24, 9);

    const bad = await post(path, { ...repeated, ambiguousTime: 'middle' });
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as any).error).toContain('ambiguousTime');
  });

  it('400 for a fractional hour, minute or second (the offset is looked up by wall-clock time)', async () => {
    const res = await post(path, { ...INDEPENDENCE, hour: 6.5, locationId: DELHI });
    expect(res.status).toBe(400);
  });

  it('still needs ayanamsa and a valid date, with locationId or not', async () => {
    expect((await post(path, { ...INDEPENDENCE, ayanamsa: undefined, locationId: DELHI })).status).toBe(400);
    expect((await post(path, { ...INDEPENDENCE, month: 2, day: 30, locationId: DELHI })).status).toBe(400);
  });
});

describe('the offset is the one in force at the birth date', () => {
  const offsetOf = async (id: number, year: number, month: number, day: number, hour = 12) => {
    const json = (await (await post('/api/calculate', { year, month, day, hour, minute: 0, ayanamsa: 'kp_old', locationId: id })).json()) as any;
    return json.location as { utcOffsetHours: number; preIanaReliableCaution: boolean; timezone: string };
  };

  it('Kuala Lumpur: +7.5 in 1980, +8 from 1982 (IANA Asia/Kuala_Lumpur)', async () => {
    expect((await offsetOf(KL, 1980, 1, 1, 10)).utcOffsetHours).toBe(7.5);
    expect((await offsetOf(KL, 1982, 1, 1, 0)).utcOffsetHours).toBe(8);
    expect((await offsetOf(KL, 1992, 3, 11, 6)).utcOffsetHours).toBe(8);
    expect((await offsetOf(KL, 2024, 7, 15)).utcOffsetHours).toBe(8);
  });

  it('Kuala Lumpur 1981-12-31 23:45 is the 30-minute gap: 400', async () => {
    const res = await post('/api/calculate', { year: 1981, month: 12, day: 31, hour: 23, minute: 45, ayanamsa: 'kp_old', locationId: KL });
    expect(res.status).toBe(400);
  });

  it('India: +5.5 in 1950 and 2024, +6.5 in the 1943 war time', async () => {
    expect((await offsetOf(DELHI, 1950, 1, 1)).utcOffsetHours).toBe(5.5);
    expect((await offsetOf(DELHI, 2024, 7, 15)).utcOffsetHours).toBe(5.5);
    expect((await offsetOf(DELHI, 1943, 6, 1)).utcOffsetHours).toBe(6.5);
  });

  it('United States: New York -4 in July and -5 in January; Arizona (Phoenix) -7 all year', async () => {
    expect((await offsetOf(NEW_YORK, 2024, 7, 15)).utcOffsetHours).toBe(-4);
    expect((await offsetOf(NEW_YORK, 2024, 1, 15)).utcOffsetHours).toBe(-5);
    expect((await offsetOf(1369, 2024, 7, 15)).utcOffsetHours).toBe(-7);
    expect((await offsetOf(1369, 2024, 1, 15)).utcOffsetHours).toBe(-7);
  });

  it('the pre-1970 caution is true up to 31 Dec 1969 and false from 1 Jan 1970', async () => {
    expect((await offsetOf(DELHI, 1969, 12, 31)).preIanaReliableCaution).toBe(true);
    expect((await offsetOf(DELHI, 1970, 1, 1)).preIanaReliableCaution).toBe(false);
    expect((await offsetOf(DELHI, 1947, 8, 15)).preIanaReliableCaution).toBe(true);
  });

  it('every row resolves an offset in range for a modern date', async () => {
    for (const l of LOCATIONS.filter((_, i) => i % 7 === 0)) {
      const r = await offsetOf(l.id, 2024, 6, 15);
      expect(r.timezone, `id ${l.id}`).toBe(l.timezone);
      expect(Math.abs(r.utcOffsetHours), `id ${l.id}`).toBeLessThanOrEqual(14);
    }
  });
});

describe('end to end against Swiss Ephemeris', () => {
  it('Kuala Lumpur 1992-03-11 06:14 local, KP Old: Sun 326.9440666 within 2 arcsec (offset +8 from the zone)', async () => {
    const json = (await (
      await post('/api/calculate', { year: 1992, month: 3, day: 11, hour: 6, minute: 14, ayanamsa: 'kp_old', locationId: KL })
    ).json()) as any;
    expect(json.location.utcOffsetHours).toBe(8);
    const sun = json.planets.find((p: any) => p.name === 'Sun');
    expect(Math.abs(sun.longitude - 326.9440666)).toBeLessThanOrEqual(2 * ARCSEC);
  });

  it('Kuala Lumpur 1980-01-01 10:00 by locationId is 30 minutes later in UT than the +8 request in the contract fixture', async () => {
    const base = { year: 1980, month: 1, day: 1, hour: 10, minute: 0, ayanamsa: 'kp_straight_line_adjusted' };
    const byId = (await (await post('/api/chart/calculate', { ...base, locationId: KL })).json()) as any;
    const fixedPlus8 = (await (
      await post('/api/chart/calculate', { ...base, utcOffsetHours: 8, latitude: 3.1667, longitude: 101.7 })
    ).json()) as any;
    // 10:00 at +7:30 is 02:30 UT; at +8 it is 02:00 UT.
    expect(byId.data.julianDateUT - fixedPlus8.data.julianDateUT).toBeCloseTo(0.5 / 24, 9);
    expect(byId.location.utcOffsetHours).toBe(7.5);
  });
});

describe('POST /api/horary with locationId', () => {
  const QUESTION = { year: 2024, month: 7, day: 15, hour: 14, minute: 30, second: 0, ayanamsa: 'kp_old', horaryNumber: 108 };

  it('is the same horary chart as the existing path, and returns the location', async () => {
    const withId = (await (await post('/api/horary', { ...QUESTION, locationId: KL })).json()) as any;
    const legacy = (await (
      await post('/api/horary', { ...QUESTION, latitude: 3.139003, longitude: 101.686855, utcOffsetHours: 8 })
    ).json()) as any;
    const { location, ...chart } = withId;
    expect(chart).toEqual(legacy);
    expect(location).toMatchObject({ id: KL, country: 'Malaysia', place: 'Kuala Lumpur', utcOffsetHours: 8, preIanaReliableCaution: false });
  });

  it('400 with locationId plus coordinates, for an unknown id, and for a gap', async () => {
    expect((await post('/api/horary', { ...QUESTION, locationId: KL, latitude: 3.1 })).status).toBe(400);
    expect((await post('/api/horary', { ...QUESTION, locationId: 424242 })).status).toBe(400);
    expect((await post('/api/horary', { ...QUESTION, year: 2024, month: 3, day: 10, hour: 2, minute: 30, locationId: NEW_YORK })).status).toBe(400);
  });
});

describe('the existing latitude / longitude / utcOffsetHours path is unchanged', () => {
  it('/api/calculate still needs utcOffsetHours, and /api/chart/calculate still stores a missing one as 0', async () => {
    const noOffset = { ...INDEPENDENCE, latitude: 28.6139, longitude: 77.209 };
    expect((await post('/api/calculate', noOffset)).status).toBe(400);
    const chart = await post('/api/chart/calculate', noOffset);
    expect(chart.status).toBe(200);
    expect(((await chart.json()) as any).location).toBeUndefined();
  });
});

describe('GET /api/chart/sample names a locationId for each sample', () => {
  it('every sample has a locationId that exists and no coordinates or offset', async () => {
    const json = (await (await app.request('/api/chart/sample')).json()) as any;
    expect(json.samples.map((s: any) => s.id)).toEqual(['india-independence', 'chennai-sample']);
    for (const s of json.samples) {
      expect(LOCATIONS.some((l) => l.id === s.input.locationId), s.id).toBe(true);
      for (const gone of ['latitude', 'longitude', 'utcOffsetHours']) expect(s.input).not.toHaveProperty(gone);
    }
    expect(json.samples[0].input.locationId).toBe(916);
    expect(json.samples[1].input.locationId).toBe(919);
  });

  it('each sample calculates through its locationId, at the same instant it always had (UT)', async () => {
    const json = (await (await app.request('/api/chart/sample')).json()) as any;
    // India Independence: 14 Aug 1947 18:30 UT; Chennai sample: 21 Nov 2026 06:25 UT.
    for (const [i, utc] of [
      [0, { year: 1947, month: 8, day: 14, hour: 18, minute: 30 }],
      [1, { year: 2026, month: 11, day: 21, hour: 6, minute: 25 }],
    ] as const) {
      const viaId = (await (await post('/api/chart/calculate', { ...json.samples[i].input })).json()) as any;
      const viaUtc = (await (
        await post('/api/chart/calculate', {
          ...utc,
          second: 0,
          utcOffsetHours: 0,
          latitude: viaId.location.latitude,
          longitude: viaId.location.longitude,
          ayanamsa: 'kp_old',
        })
      ).json()) as any;
      expect(viaId.data.julianDateUT).toBe(viaUtc.data.julianDateUT);
    }
  });
});
