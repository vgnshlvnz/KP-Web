import test from 'node:test';
import assert from 'node:assert';
import worker from '../dist/worker.js';

test('Worker GET / and /api/health return engine info and NASA licensing', async () => {
  const req = new Request('https://kp-web.example.com/api/health', {
    method: 'GET',
  });
  const res = await worker.fetch(req);
  assert.strictEqual(res.status, 200);

  const data = (await res.json()) as Record<string, unknown>;
  assert.strictEqual(data.status, 'ok');
  assert.strictEqual(data.service, 'KP-Web Astrology Engine');
  assert.ok(String(data.engine).includes('NASA JPL'));
  assert.ok(String(data.licensing).includes('NASA'));
  assert.ok(String(data.runtime).includes('Cloudflare Workers'));
});

test('Worker GET /api/ayanamsa returns KP Old and KP New values', async () => {
  const req = new Request('https://kp-web.example.com/api/ayanamsa?date=2026-11-21T06:00:00Z', {
    method: 'GET',
  });
  const res = await worker.fetch(req);
  assert.strictEqual(res.status, 200);

  const data = (await res.json()) as {
    kpOld: { degrees: number; dms: string };
    kpNew: { degrees: number; dms: string };
    differenceArcsec: number;
  };
  assert.ok(data.kpOld.degrees > 24.1);
  assert.ok(data.kpNew.degrees > 24.1);
  assert.ok(Math.abs(data.differenceArcsec - 72.44) < 0.1);
});

test('Worker GET /api/horary-table returns full table and specific entry', async () => {
  // Full table
  const reqAll = new Request('https://kp-web.example.com/api/horary-table', {
    method: 'GET',
  });
  const resAll = await worker.fetch(reqAll);
  assert.strictEqual(resAll.status, 200);
  const dataAll = (await resAll.json()) as Array<{ horaryNumber: number }>;
  assert.strictEqual(dataAll.length, 249);

  // Single entry #108
  const req108 = new Request('https://kp-web.example.com/api/horary-table?number=108', {
    method: 'GET',
  });
  const res108 = await worker.fetch(req108);
  assert.strictEqual(res108.status, 200);
  const data108 = (await res108.json()) as {
    horaryNumber: number;
    signName: string;
    subLord: string;
  };
  assert.strictEqual(data108.horaryNumber, 108);
  assert.strictEqual(data108.signName, 'Virgo');
  assert.strictEqual(data108.subLord, 'Saturn');
});

test('Worker POST /api/calculate computes natal chart', async () => {
  const req = new Request('https://kp-web.example.com/api/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dateTime: {
        year: 1990,
        month: 5,
        day: 15,
        hour: 14,
        minute: 30,
        second: 0,
        timezoneOffsetHours: 0,
      },
      coordinates: {
        latitude: 13.0827,
        longitude: 80.2707,
      },
      ayanamsaMode: 'KP_OLD',
    }),
  });

  const res = await worker.fetch(req);
  assert.strictEqual(res.status, 200);
  const data = (await res.json()) as {
    planets: unknown[];
    houses: unknown[];
    ascendant: { signName: string };
  };
  assert.strictEqual(data.planets.length, 12);
  assert.strictEqual(data.houses.length, 12);
  assert.ok(data.ascendant.signName);
});

test('Worker POST /api/horary computes horary chart', async () => {
  const req = new Request('https://kp-web.example.com/api/horary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      horaryNumber: 108,
      dateUtc: '2026-11-21T06:00:00Z',
      coordinates: {
        latitude: 13.0827,
        longitude: 80.2707,
      },
      ayanamsaMode: 'KP_OLD',
      useSubMidpoint: false,
    }),
  });

  const res = await worker.fetch(req);
  assert.strictEqual(res.status, 200);
  const data = (await res.json()) as {
    horaryNumber: number;
    lagnaTargetDeg: number;
    ascendant: { signName: string; subLord: string };
  };
  assert.strictEqual(data.horaryNumber, 108);
  assert.ok(Math.abs(data.lagnaTargetDeg - 153.0) < 1e-10);
  assert.strictEqual(data.ascendant.signName, 'Virgo');
  assert.strictEqual(data.ascendant.subLord, 'Saturn');
});

test('Worker OPTIONS preflight returns CORS headers', async () => {
  const req = new Request('https://kp-web.example.com/api/calculate', {
    method: 'OPTIONS',
  });
  const res = await worker.fetch(req);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.headers.get('Access-Control-Allow-Origin'), '*');
});

test('Worker handles invalid input with 400 Bad Request', async () => {
  const req = new Request('https://kp-web.example.com/api/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const res = await worker.fetch(req);
  assert.strictEqual(res.status, 400);
  const data = (await res.json()) as { error: string };
  assert.ok(data.error);
});
