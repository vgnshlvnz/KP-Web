import { describe, expect, it } from 'vitest';
import app from '../src/index.js';
import page from '../public/index.html?raw';

/**
 * The page contract for #68. The captured chart/calculate fixture lives in #85;
 * this file does not copy it. It checks the page source, then the same Kuala Lumpur
 * request the page sends: longitudes from `POST /api/calculate`, forwarded as
 * `{ name, longitude }` to `POST /api/chart/calculate`.
 */

/** 1980-01-01 10:00, Kuala Lumpur, offset +8. Same body as the fixture. */
const KUALA_LUMPUR_1980 = {
  year: 1980,
  month: 1,
  day: 1,
  hour: 10,
  minute: 0,
  second: 0,
  utcOffsetHours: 8,
  latitude: 3.1667,
  longitude: 101.7,
  ayanamsa: 'kp_straight_line_adjusted',
};

const post = (path: string, body: unknown) =>
  app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('public/index.html request and response contract', () => {
  it('sends an ayanamsa and utcOffsetHours, and no longer reads fields the API does not return', () => {
    expect(page).toContain('value="kp_new" selected');
    expect(page).toContain('utcOffsetHours');
    expect(page).toContain("postJson('/api/calculate'");
    expect(page).toContain("postJson('/api/chart/calculate'");
    expect(page).toContain('ayanamsa');
    expect(page).not.toContain('id="inpPlanets"');
    expect(page).not.toContain('/api/places/search');
    expect(page).not.toContain('/api/timezone/offset');
    expect(page).not.toContain('/api/charts/validate-input');

    for (const dead of [
      'ayanamsaDeg',
      'siderealTimeDeg',
      'obliquityDeg',
      'nutationInLongitudeArcsec',
      'formattedDms',
      'zodiacSign',
      'assignedHouse',
      'houseSignificators',
      'houseStartCusp',
      'houseEndCusp',
      'signNumber',
      'cuspFormattedDms',
    ]) {
      expect(page, dead).not.toContain(dead);
    }
    expect(page).not.toMatch(/julianDate(?!UT)/);

    for (const live of [
      'julianDateUT',
      'localSiderealTimeDegrees',
      'obliquityTrue',
      'nutationInLongitude',
      'ayanamsaValue',
      'signName',
      'signIndex',
      'houseWise',
      'distancePassedCusp',
      'distanceToNextCusp',
      'cuspFormatted',
    ]) {
      expect(page, live).toContain(live);
    }
  });

  it('Kuala Lumpur 1980: no longitudes omits planets, and forwarding /api/calculate longitudes fills them', async () => {
    const bareRes = await post('/api/calculate', KUALA_LUMPUR_1980);
    expect(bareRes.status).toBe(200);
    const bare = (await bareRes.json()) as { planets: Array<{ name: string; longitude: number }> };
    expect(bare).not.toHaveProperty('success');
    expect(bare.planets).toHaveLength(9);
    const planets = bare.planets.map((p) => ({ name: p.name, longitude: p.longitude }));
    for (const p of planets) {
      expect(p.name).toBeTruthy();
      expect(Number.isFinite(p.longitude)).toBe(true);
    }

    const withoutLongitudes = (await (await post('/api/chart/calculate', KUALA_LUMPUR_1980)).json()) as {
      success: boolean;
      data: Record<string, unknown>;
    };
    expect(withoutLongitudes.success).toBe(true);
    expect(withoutLongitudes.data).not.toHaveProperty('planets');
    expect(withoutLongitudes.data).not.toHaveProperty('significators');

    const chartRes = await post('/api/chart/calculate', { ...KUALA_LUMPUR_1980, planets });
    expect(chartRes.status).toBe(200);
    const chart = (await chartRes.json()) as { success: boolean; data: any };
    expect(chart.success).toBe(true);
    const data = chart.data;

    // Adding longitudes must not move the cusps or the clock.
    expect(data.julianDateUT).toBe(withoutLongitudes.data.julianDateUT);
    expect(data.localSiderealTimeDegrees).toBe(withoutLongitudes.data.localSiderealTimeDegrees);
    expect(data.obliquityTrue).toBe(withoutLongitudes.data.obliquityTrue);
    expect(data.nutationInLongitude).toBe(withoutLongitudes.data.nutationInLongitude);
    expect(data.ayanamsaValue).toBe(withoutLongitudes.data.ayanamsaValue);
    expect(data.ayanamsaType).toBe('kp_straight_line_adjusted');
    expect(data.cusps).toEqual(withoutLongitudes.data.cusps);

    expect(data.planets).toHaveLength(9);
    const text = (value: unknown) => {
      expect(typeof value).toBe('string');
      expect(String(value)).not.toMatch(/undefined|NaN/);
    };
    for (const c of data.cusps) {
      text(c.formatted);
      text(c.signName);
      expect(Number.isFinite(c.longitude)).toBe(true);
      expect(Number.isInteger(c.house)).toBe(true);
      expect(c.signLord && c.starLord && c.subLord && c.subSubLord).toBeTruthy();
    }
    for (const p of data.planets) {
      text(p.name);
      text(p.formatted);
      text(p.signName);
      text(p.starLord);
      text(p.subLord);
      expect(Number.isInteger(p.signIndex)).toBe(true);
      expect(p.house).toBeGreaterThanOrEqual(1);
      expect(p.house).toBeLessThanOrEqual(12);
      expect(Number.isFinite(p.distancePassedCusp)).toBe(true);
      expect(Number.isFinite(p.distanceToNextCusp)).toBe(true);
      expect(p).not.toHaveProperty('houseStartCusp');
      expect(p).not.toHaveProperty('houseEndCusp');
    }
    expect(data.significators.houseWise).toHaveLength(12);
    expect(data.significators.planetWise.length).toBeGreaterThan(0);
    expect(Array.isArray(data.chartWheels.southIndian)).toBe(true);
    expect(Array.isArray(data.chartWheels.northIndian)).toBe(true);
    expect(data.chartWheels.southIndian).toHaveLength(12);
    expect(data.chartWheels.northIndian).toHaveLength(12);
    expect(data.chartWheels.southIndian[0].signIndex).toBe(0);
    text(data.chartWheels.northIndian[0].cuspFormatted);
    for (const box of data.chartWheels.southIndian) {
      for (const cusp of box.cusps) text(cusp.formatted);
      for (const planet of box.planets) {
        text(planet.name);
        expect(Number.isInteger(planet.house)).toBe(true);
      }
    }
  });

  it('positive utcOffsetHours is east of Greenwich: 10:00 at +8 is 02:00 UT, and a missing offset is 10:00 UT', async () => {
    const withOffset = (await (await post('/api/chart/calculate', KUALA_LUMPUR_1980)).json()) as {
      data: { julianDateUT: number };
    };
    const { utcOffsetHours: _omit, ...noOffset } = KUALA_LUMPUR_1980;
    const missing = (await (await post('/api/chart/calculate', noOffset)).json()) as {
      data: { julianDateUT: number };
    };
    const atUtc = (await (
      await post('/api/chart/calculate', { ...KUALA_LUMPUR_1980, utcOffsetHours: 0 })
    ).json()) as { data: { julianDateUT: number } };

    // 8 hours earlier than the same clock time read as UT.
    expect(atUtc.data.julianDateUT - withOffset.data.julianDateUT).toBeCloseTo(8 / 24, 8);
    expect(missing.data.julianDateUT).toBe(atUtc.data.julianDateUT);
  });
});
