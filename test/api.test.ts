import { describe, expect, it } from 'vitest';
import app from '../src/index';

describe('Cloudflare Worker API Routes', () => {
  it('GET /api/health returns health status', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.status).toBe('ok');
    expect(data.engine).toBe('KP-Web');
    expect(data.runtime).toBe('Cloudflare Worker');
  });

  it('GET /api/places/search returns open-source geocoded cities', async () => {
    const res = await app.request('/api/places/search?q=chennai');
    expect(res.status).toBe(200);
    const data = (await res.json()) as { query: string; count: number; results: Array<{ name: string; timezone: string }>; source: string };
    expect(data.query).toBe('chennai');
    expect(data.count).toBeGreaterThan(0);
    expect(data.results[0].name).toBe('Chennai');
    expect(data.results[0].timezone).toBe('Asia/Kolkata');
    expect(data.source).toContain('GeoNames Open Data');
  });

  it('GET /api/places/search clamps limit safely', async () => {
    const resNegative = await app.request('/api/places/search?q=in&limit=-5');
    expect(resNegative.status).toBe(200);
    const dataNeg = (await resNegative.json()) as { count: number };
    expect(dataNeg.count).toBe(1);

    const resLarge = await app.request('/api/places/search?q=in&limit=999');
    expect(resLarge.status).toBe(200);
    const dataLarge = (await resLarge.json()) as { count: number };
    expect(dataLarge.count).toBeLessThanOrEqual(50);
  });

  it('POST /api/timezone/offset rejects invalid date or time components', async () => {
    const res = await app.request('/api/timezone/offset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year: 2024,
        month: 2,
        day: 30, // Invalid date
        hours: 14,
        minutes: 30,
        seconds: 25,
        timezone: 'Asia/Kolkata',
      }),
    });
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain('Day must be between 1 and 29');
  });

  it('POST /api/timezone/offset computes accurate UTC offset', async () => {
    const payload = {
      year: 1985,
      month: 5,
      day: 15,
      hours: 14,
      minutes: 30,
      seconds: 25,
      timezone: 'Asia/Kolkata',
    };

    const res = await app.request('/api/timezone/offset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as { offsetString: string; offsetMinutes: number; utcDateTimeString: string };
    expect(data.offsetString).toBe('UTC+05:30');
    expect(data.offsetMinutes).toBe(330);
    expect(data.utcDateTimeString).toBe('1985-05-15T09:00:25.000Z');
  });

  it('POST /api/charts/validate-input validates input and stores record', async () => {
    const payload = {
      date: '1985-05-15',
      hours: 14,
      minutes: 30,
      seconds: 25,
      placeText: 'Chennai, Tamil Nadu, India',
      latitude: 13.0827,
      longitude: 80.2707,
      timezone: 'Asia/Kolkata',
      country: 'India',
      countryCode: 'IN',
      ayanamsa: 'kp_old',
    };

    const res = await app.request('/api/charts/validate-input', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as { valid: boolean; chart: { id: string; rawInput: { seconds: number; ayanamsa: string } } };
    expect(data.valid).toBe(true);
    expect(data.chart).toBeDefined();
    expect(data.chart.rawInput.seconds).toBe(25);
    expect(data.chart.rawInput.ayanamsa).toBe('kp_old');

    // Retrieve via GET /api/charts/:id
    const getRes = await app.request(`/api/charts/${data.chart.id}`);
    expect(getRes.status).toBe(200);
    const retrieved = (await getRes.json()) as { id: string };
    expect(retrieved.id).toBe(data.chart.id);
  });

  it('POST /api/charts/validate-input rejects invalid input with clear error codes', async () => {
    const invalidPayload = {
      date: '1985-02-30', // Invalid date
      hours: 14,
      minutes: 30,
      seconds: 25,
      placeText: 'Nowhere',
      latitude: 13.0827,
      longitude: 80.2707,
      timezone: 'Asia/Kolkata',
      ayanamsa: 'lahiri', // Rejected
    };

    const res = await app.request('/api/charts/validate-input', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidPayload),
    });

    expect(res.status).toBe(400);
    const data = (await res.json()) as { valid: boolean; errors: Record<string, string> };
    expect(data.valid).toBe(false);
    expect(data.errors.date).toBeDefined();
    expect(data.errors.ayanamsa).toBeDefined();
  });

  it('GET / serves the interactive web UI', async () => {
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('KP-Web');
    expect(html).toContain('Birth Data Input');
    expect(html).toContain('KP Old');
    expect(html).toContain('KP New');
  });
});
