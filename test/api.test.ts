import { describe, it, expect } from 'vitest';
import app from '../src/index.js';

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
