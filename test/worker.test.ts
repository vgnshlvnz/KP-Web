import { describe, it, expect } from 'vitest';
import worker from '../src/worker.js';

describe('Worker', () => {
  it('Worker GET / and /api/health return engine info and NASA licensing', async () => {
    const req = new Request('https://kp-web.example.com/api/health', {
      method: 'GET',
    });
    const res = await worker.fetch(req);
    expect(res.status).toBe(200);

    const data = (await res.json()) as Record<string, unknown>;
    expect(data.status).toBe('ok');
    expect(data.service).toBe('KP-Web Astrology Engine');
    expect(String(data.engine).includes('NASA JPL')).toBe(true);
    expect(String(data.licensing).includes('NASA')).toBe(true);
    expect(String(data.runtime).includes('Cloudflare Workers')).toBe(true);
  });

  it('Worker GET /api/ayanamsa returns KP Old and KP New values', async () => {
    const req = new Request('https://kp-web.example.com/api/ayanamsa?date=2026-11-21T06:00:00Z', {
      method: 'GET',
    });
    const res = await worker.fetch(req);
    expect(res.status).toBe(200);

    const data = (await res.json()) as {
      kpOld: { degrees: number; dms: string };
      kpNew: { degrees: number; dms: string };
      differenceArcsec: number;
    };
    expect(data.kpOld.degrees > 24.1).toBe(true);
    expect(data.kpNew.degrees > 24.1).toBe(true);
    expect(Math.abs(data.differenceArcsec - 72.44) < 0.1).toBe(true);
  });

  it('Worker GET /api/horary-table returns full table and specific entry', async () => {
    // Full table
    const reqAll = new Request('https://kp-web.example.com/api/horary-table', {
      method: 'GET',
    });
    const resAll = await worker.fetch(reqAll);
    expect(resAll.status).toBe(200);
    const dataAll = (await resAll.json()) as Array<{ horaryNumber: number }>;
    expect(dataAll.length).toBe(249);

    // Single entry #108
    const req108 = new Request('https://kp-web.example.com/api/horary-table?number=108', {
      method: 'GET',
    });
    const res108 = await worker.fetch(req108);
    expect(res108.status).toBe(200);
    const data108 = (await res108.json()) as {
      horaryNumber: number;
      signName: string;
      subLord: string;
    };
    expect(data108.horaryNumber).toBe(108);
    expect(data108.signName).toBe('Virgo');
    expect(data108.subLord).toBe('Saturn');
  });

  it('Worker POST /api/calculate computes natal chart', async () => {
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
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      planets: unknown[];
      houses: unknown[];
      ascendant: { signName: string };
    };
    expect(data.planets.length).toBe(12);
    expect(data.houses.length).toBe(12);
    expect(data.ascendant.signName).toBeTruthy();
  });

  it('Worker POST /api/horary computes horary chart', async () => {
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
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      horaryNumber: number;
      lagnaTargetDeg: number;
      ascendant: { signName: string; subLord: string };
    };
    expect(data.horaryNumber).toBe(108);
    expect(Math.abs(data.lagnaTargetDeg - 153.0) < 1e-10).toBe(true);
    expect(data.ascendant.signName).toBe('Virgo');
    expect(data.ascendant.subLord).toBe('Saturn');
  });

  it('Worker OPTIONS preflight returns CORS headers', async () => {
    const req = new Request('https://kp-web.example.com/api/calculate', {
      method: 'OPTIONS',
    });
    const res = await worker.fetch(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('Worker handles invalid input with 400 Bad Request', async () => {
    const req = new Request('https://kp-web.example.com/api/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await worker.fetch(req);
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBeTruthy();
  });
});
