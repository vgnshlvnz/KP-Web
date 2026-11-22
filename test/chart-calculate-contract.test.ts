import { describe, expect, it } from 'vitest';
import app from '../src/index.js';
import { calculateEphemeris } from '../src/engine/ephemeris.js';
import fixture from './fixtures/api-chart-calculate-kl-1980.json';

/**
 * Contract for `POST /api/chart/calculate` (Refs #68).
 *
 * The fixture is the handler's own JSON for 1980-01-01 10:00 at Kuala Lumpur
 * (latitude +3.1667, longitude +101.7, utcOffsetHours +8). `ayanamsa` is
 * `kp_straight_line_adjusted` because the route rejects a missing ayanamsa;
 * that id is the option selected in `public/index.html`. No planet longitudes
 * are sent: this route does not compute them.
 *
 * `utcOffsetHours` is hours ahead of Universal Time (positive east).
 * UT = local clock − utcOffsetHours, so 10:00 at +8 is 02:00 UT.
 */

/** Absolute tolerance for angles and sidereal time, in the field's own unit. 1e-6 deg is 0.0036 arcsec; 1e-6 hour is 0.0036 seconds of time. */
const QUANTITY_TOLERANCE = 1e-6;
/** Julian date tolerance in days. 1e-8 day is about 0.00086 seconds. */
const JULIAN_DATE_TOLERANCE_DAYS = 1e-8;

/**
 * 1980-01-01 10:00, Kuala Lumpur, offset +8.
 * Ayanamsa is required by the route; KP Straight Line (Adjusted) is the UI's selected option.
 */
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

/** Keys of `data` when the request supplies no planet longitudes (`planets` and `significators` are omitted). */
const DATA_KEYS = [
  'input',
  'ayanamsaType',
  'ayanamsaName',
  'ayanamsaValue',
  'julianDateUT',
  'greenwichMeanSiderealTime',
  'greenwichApparentSiderealTime',
  'localSiderealTimeHours',
  'localSiderealTimeDegrees',
  'armc',
  'obliquityMean',
  'obliquityTrue',
  'nutationInLongitude',
  'nutationInObliquity',
  'ascendant',
  'midheaven',
  'cusps',
  'chartWheels',
  'isPolarFallback',
  'warnings',
] as const;

const INPUT_KEYS = [
  'year',
  'month',
  'day',
  'hour',
  'minute',
  'second',
  'utcOffsetHours',
  'latitude',
  'longitude',
] as const;

/** One Placidus cusp, as `buildKPCusp` / `getPositionLords` return it on this route. */
const CUSP_KEYS = [
  'longitude',
  'signIndex',
  'signName',
  'signLord',
  'degreeInSign',
  'formatted',
  'degrees',
  'minutes',
  'seconds',
  'starIndex',
  'starNumber',
  'starName',
  'starLord',
  'subLord',
  'subSubLord',
  'horary249Number',
  'house',
  'nextCuspLongitude',
  'houseSpan',
] as const;

/**
 * One entry of `data.planets` when the client sends `{ name, longitude }` and no speed.
 * `isRetrograde` is omitted in that case. House is `house` (1–12); sign is `signName` / `signIndex`.
 */
const PLANET_ENTRY_KEYS = [
  'longitude',
  'signIndex',
  'signName',
  'signLord',
  'degreeInSign',
  'formatted',
  'degrees',
  'minutes',
  'seconds',
  'starIndex',
  'starNumber',
  'starName',
  'starLord',
  'subLord',
  'subSubLord',
  'horary249Number',
  'name',
  'house',
  'distancePassedCusp',
  'distanceToNextCusp',
] as const;

const PLANET_NAMES = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'] as const;

const post = (body: unknown) =>
  app.request('/api/chart/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

async function calculate(body: unknown): Promise<{ status: number; json: any }> {
  const res = await post(body);
  return { status: res.status, json: await res.json() };
}

/** Compare two JSON trees. Numbers use an absolute tolerance; every other leaf must be equal. */
function expectClose(actual: unknown, expected: unknown, path: string, tolerance: number): void {
  if (typeof expected === 'number') {
    expect(typeof actual, path).toBe('number');
    expect(Math.abs((actual as number) - expected), path).toBeLessThan(tolerance);
    return;
  }
  if (Array.isArray(expected)) {
    expect(Array.isArray(actual), path).toBe(true);
    const got = actual as unknown[];
    expect(got, path).toHaveLength(expected.length);
    expected.forEach((item, i) => expectClose(got[i], item, `${path}[${i}]`, tolerance));
    return;
  }
  if (expected !== null && typeof expected === 'object') {
    expect(actual !== null && typeof actual === 'object', path).toBe(true);
    const got = actual as Record<string, unknown>;
    const exp = expected as Record<string, unknown>;
    expect(Object.keys(got).sort(), path).toEqual(Object.keys(exp).sort());
    for (const key of Object.keys(exp)) {
      expectClose(got[key], exp[key], `${path}.${key}`, tolerance);
    }
    return;
  }
  expect(actual, path).toEqual(expected);
}

describe('POST /api/chart/calculate contract (Kuala Lumpur 1980-01-01 10:00 +08)', () => {
  it('returns the captured fixture for the sample request', async () => {
    const { status, json } = await calculate(KUALA_LUMPUR_1980);
    expect(status).toBe(200);
    expect(json).toEqual(fixture);
  });

  it('pins the response envelope, chart fields, cusps, ayanamsa, Julian date and sidereal time', async () => {
    const { json } = await calculate(KUALA_LUMPUR_1980);
    expect(Object.keys(json)).toEqual(['success', 'data']);
    expect(json.success).toBe(true);

    const data = json.data;
    expect(Object.keys(data)).toEqual([...DATA_KEYS]);
    expect(Object.keys(data.input)).toEqual([...INPUT_KEYS]);
    expect(data.input).toEqual({
      year: 1980,
      month: 1,
      day: 1,
      hour: 10,
      minute: 0,
      second: 0,
      utcOffsetHours: 8,
      latitude: 3.1667,
      longitude: 101.7,
    });

    expect(data.ayanamsaType).toBe('kp_straight_line_adjusted');
    expect(data.ayanamsaName).toBe('KP Straight Line (Adjusted)');
    expect(typeof data.ayanamsaValue).toBe('number');
    expect(Number.isFinite(data.ayanamsaValue)).toBe(true);

    expect(typeof data.julianDateUT).toBe('number');
    expect(typeof data.greenwichMeanSiderealTime).toBe('number');
    expect(typeof data.greenwichApparentSiderealTime).toBe('number');
    expect(typeof data.localSiderealTimeHours).toBe('number');
    expect(typeof data.localSiderealTimeDegrees).toBe('number');
    // Local sidereal time is stored in hours and in degrees (degrees = hours × 15). ARMC is that angle.
    expect(Math.abs(data.localSiderealTimeHours * 15 - data.localSiderealTimeDegrees)).toBeLessThan(QUANTITY_TOLERANCE);
    expect(Math.abs(data.armc - data.localSiderealTimeDegrees)).toBeLessThan(QUANTITY_TOLERANCE);

    // Julian day fraction is measured from noon, so 02:00 UT is 0.5 + 2/24.
    const fraction = data.julianDateUT - Math.floor(data.julianDateUT);
    expect(Math.abs(fraction - (0.5 + 2 / 24))).toBeLessThan(JULIAN_DATE_TOLERANCE_DAYS);

    expect(data.cusps).toHaveLength(12);
    expect(data.cusps.map((c: { house: number }) => c.house)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    for (const cusp of data.cusps) {
      expect(Object.keys(cusp)).toEqual([...CUSP_KEYS]);
      expect(cusp.signIndex).toBeGreaterThanOrEqual(0);
      expect(cusp.signIndex).toBeLessThanOrEqual(11);
      expect(cusp.signName).toBe(data.chartWheels.southIndian[cusp.signIndex].signName);
      expect(typeof cusp.signLord).toBe('string');
      expect(typeof cusp.formatted).toBe('string');
    }

    expect(Object.keys(data.chartWheels)).toEqual(['southIndian', 'northIndian']);
    expect(data.chartWheels.southIndian).toHaveLength(12);
    expect(data.chartWheels.northIndian).toHaveLength(12);
    for (const box of data.chartWheels.southIndian) {
      expect(Object.keys(box)).toEqual(['signIndex', 'signName', 'signLord', 'cusps', 'planets']);
      expect(box.planets).toEqual([]);
      for (const cusp of box.cusps) {
        expect(Object.keys(cusp)).toEqual(['house', 'formatted', 'longitude']);
      }
    }
    for (const house of data.chartWheels.northIndian) {
      expect(Object.keys(house)).toEqual([
        'house',
        'signIndex',
        'signName',
        'signLord',
        'cuspLongitude',
        'cuspFormatted',
        'planets',
      ]);
      expect(house.planets).toEqual([]);
    }

    expect(data.isPolarFallback).toBe(false);
    expect(data.warnings).toEqual([]);
  });

  it('applies utcOffsetHours as local minus offset: 10:00 at +8 is 02:00 UT', async () => {
    const local = (await calculate(KUALA_LUMPUR_1980)).json.data;
    const asUt = (
      await calculate({ ...KUALA_LUMPUR_1980, hour: 2, utcOffsetHours: 0 })
    ).json.data;

    expect(local.input.hour).toBe(10);
    expect(local.input.utcOffsetHours).toBe(8);
    expect(asUt.input.hour).toBe(2);
    expect(asUt.input.utcOffsetHours).toBe(0);

    expect(Math.abs(local.julianDateUT - asUt.julianDateUT)).toBeLessThan(JULIAN_DATE_TOLERANCE_DAYS);
    const { input: _localInput, ...localChart } = local;
    const { input: _utInput, ...utChart } = asUt;
    expectClose(localChart, utChart, 'chart', QUANTITY_TOLERANCE);

    // The opposite sign would make 10:00 at +8 into 18:00 UT. That chart is 16 hours away.
    const opposite = (
      await calculate({ ...KUALA_LUMPUR_1980, hour: 18, utcOffsetHours: 0 })
    ).json.data;
    const hoursApart = (local.julianDateUT - opposite.julianDateUT) * 24;
    expect(Math.abs(hoursApart - -16)).toBeLessThan(1e-4);
  });

  it('a missing utcOffsetHours is the same instant as offset 0, eight hours from offset +8', async () => {
    const { utcOffsetHours: _omit, ...noOffset } = KUALA_LUMPUR_1980;
    const omitted = (await calculate(noOffset)).json.data;
    const explicitZero = (
      await calculate({ ...KUALA_LUMPUR_1980, utcOffsetHours: 0 })
    ).json.data;
    const plusEight = (await calculate(KUALA_LUMPUR_1980)).json.data;

    expect(omitted.input.utcOffsetHours).toBe(0);
    expect(Math.abs(omitted.julianDateUT - explicitZero.julianDateUT)).toBeLessThan(JULIAN_DATE_TOLERANCE_DAYS);
    const hoursFromPlusEight = (omitted.julianDateUT - plusEight.julianDateUT) * 24;
    expect(Math.abs(hoursFromPlusEight - 8)).toBeLessThan(1e-4);
  });

  it('pins planet names and entry fields when sidereal longitudes are supplied', async () => {
    // This route assigns the longitudes the client sends. The nine longitudes come from the
    // engine ephemeris at the same UT instant (02:00 on 1980-01-01); they are not written by hand.
    const ephemeris = calculateEphemeris(new Date(Date.UTC(1980, 0, 1, 2, 0, 0)), {
      ayanamsa: 'kp_straight_line_adjusted',
    });
    expect(ephemeris.planets.map((p) => p.name)).toEqual([...PLANET_NAMES]);

    const { status, json } = await calculate({
      ...KUALA_LUMPUR_1980,
      planets: ephemeris.planets.map((p) => ({ name: p.name, longitude: p.siderealLongitude })),
    });
    expect(status).toBe(200);
    expect(Object.keys(json.data)).toEqual([
      ...DATA_KEYS.slice(0, DATA_KEYS.indexOf('cusps') + 1),
      'planets',
      'significators',
      ...DATA_KEYS.slice(DATA_KEYS.indexOf('chartWheels')),
    ]);

    expect(json.data.planets).toHaveLength(PLANET_NAMES.length);
    json.data.planets.forEach((planet: any, i: number) => {
      const source = ephemeris.planets[i];
      expect(Object.keys(planet)).toEqual([...PLANET_ENTRY_KEYS]);
      expect(planet.name).toBe(PLANET_NAMES[i]);
      expect(planet.name).toBe(source.name);
      expect(Math.abs(planet.longitude - source.siderealLongitude)).toBeLessThan(QUANTITY_TOLERANCE);
      expect(planet.house).toBeGreaterThanOrEqual(1);
      expect(planet.house).toBeLessThanOrEqual(12);
      expect(Number.isInteger(planet.house)).toBe(true);
      expect(planet.signIndex).toBe(Math.floor(planet.longitude / 30));
      expect(planet.signName).toBe(json.data.chartWheels.southIndian[planet.signIndex].signName);
      expect(typeof planet.signLord).toBe('string');
      expect(typeof planet.starLord).toBe('string');
      expect(typeof planet.subLord).toBe('string');
      expect(typeof planet.subSubLord).toBe('string');
      expect(typeof planet.formatted).toBe('string');
      expect(planet.distancePassedCusp).toBeGreaterThanOrEqual(0);
      expect(planet.distanceToNextCusp).toBeGreaterThanOrEqual(0);
    });

    expect(Object.keys(json.data.significators)).toEqual(['houseWise', 'planetWise']);
    expect(json.data.significators.houseWise).toHaveLength(12);
    expect(json.data.significators.planetWise).toHaveLength(PLANET_NAMES.length);
    for (const row of json.data.significators.houseWise) {
      expect(Object.keys(row)).toEqual(['house', 'level1', 'level2', 'level3', 'level4', 'allSignificators']);
    }
    for (const row of json.data.significators.planetWise) {
      expect(Object.keys(row)).toEqual(['planet', 'signifiesHouses']);
      expect(Object.keys(row.signifiesHouses)).toEqual(['level1', 'level2', 'level3', 'level4', 'all']);
    }

    const southPlanets = json.data.chartWheels.southIndian.flatMap((box: { planets: unknown[] }) => box.planets);
    const northPlanets = json.data.chartWheels.northIndian.flatMap((box: { planets: unknown[] }) => box.planets);
    expect(southPlanets).toHaveLength(PLANET_NAMES.length);
    expect(northPlanets).toHaveLength(PLANET_NAMES.length);
    for (const planet of southPlanets) {
      expect(Object.keys(planet)).toEqual(['name', 'formatted', 'longitude', 'house']);
    }
    for (const planet of northPlanets) {
      expect(Object.keys(planet)).toEqual(['name', 'formatted', 'longitude']);
    }
  });
});
