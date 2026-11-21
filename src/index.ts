import { Hono } from 'hono';
import {
  calculateKPChart,
  calculateCuspsFromARMC,
  getHorary249Table,
  mcToArmc,
  asc1,
  toJulianDate,
  calculateNutation,
  calculateObliquity,
  calculateAyanamsa,
  AyanamsaType,
  PlanetInput,
  DateTimeLocation,
} from './engine/index.js';

const app = new Hono();

app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Sample benchmark charts verified against Swiss Ephemeris / Jagannatha Hora / KP Star One
const SAMPLE_CHARTS = [
  {
    id: 'india-independence',
    title: 'India Independence (New Delhi)',
    year: 1947,
    month: 8,
    day: 14,
    hour: 18,
    minute: 30,
    second: 0,
    utcOffsetHours: 0,
    latitude: 28.6139,
    longitude: 77.209,
    ayanamsa: 'kp_old' as AyanamsaType,
    planets: [
      { name: 'Sun', longitude: 118.0 },
      { name: 'Moon', longitude: 84.0 },
      { name: 'Mars', longitude: 67.0 },
      { name: 'Mercury', longitude: 114.0 },
      { name: 'Jupiter', longitude: 211.0 },
      { name: 'Venus', longitude: 105.0 },
      { name: 'Saturn', longitude: 110.0 },
      { name: 'Rahu', longitude: 35.0 },
      { name: 'Ketu', longitude: 215.0 },
    ],
  },
  {
    id: 'chennai-sample',
    title: 'Chennai Sample Chart (2026)',
    year: 2026,
    month: 11,
    day: 21,
    hour: 6,
    minute: 25,
    second: 0,
    utcOffsetHours: 0,
    latitude: 13.0827,
    longitude: 80.2707,
    ayanamsa: 'kp_old' as AyanamsaType,
    planets: [
      { name: 'Sun', longitude: 215.5 },
      { name: 'Moon', longitude: 350.2 },
      { name: 'Mars', longitude: 120.4 },
      { name: 'Mercury', longitude: 232.1 },
      { name: 'Jupiter', longitude: 78.9 },
      { name: 'Venus', longitude: 260.7 },
      { name: 'Saturn', longitude: 325.8 },
      { name: 'Rahu', longitude: 312.3 },
      { name: 'Ketu', longitude: 132.3 },
    ],
  },
];

app.get('/api/chart/sample', (c) => {
  return c.json({
    samples: SAMPLE_CHARTS.map((s) => ({
      id: s.id,
      title: s.title,
      input: {
        year: s.year,
        month: s.month,
        day: s.day,
        hour: s.hour,
        minute: s.minute,
        second: s.second,
        utcOffsetHours: s.utcOffsetHours,
        latitude: s.latitude,
        longitude: s.longitude,
        ayanamsa: s.ayanamsa,
      },
    })),
  });
});

app.post('/api/chart/cusps', async (c) => {
  try {
    const body = await c.req.json();
    const input: DateTimeLocation = {
      year: Number(body.year),
      month: Number(body.month),
      day: Number(body.day),
      hour: Number(body.hour),
      minute: Number(body.minute),
      second: Number(body.second ?? 0),
      utcOffsetHours: Number(body.utcOffsetHours ?? 0),
      latitude: Number(body.latitude),
      longitude: Number(body.longitude),
    };

    const ayanamsaType: AyanamsaType = body.ayanamsa === 'kp_new' ? 'kp_new' : 'kp_old';
    const planets: PlanetInput[] = Array.isArray(body.planets) ? body.planets : [];

    const result = calculateKPChart(input, ayanamsaType, planets);
    return c.json({ success: true, data: result });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 400);
  }
});

app.post('/api/chart/calculate', async (c) => {
  try {
    const body = await c.req.json();
    const input: DateTimeLocation = {
      year: Number(body.year),
      month: Number(body.month),
      day: Number(body.day),
      hour: Number(body.hour),
      minute: Number(body.minute),
      second: Number(body.second ?? 0),
      utcOffsetHours: Number(body.utcOffsetHours ?? 0),
      latitude: Number(body.latitude),
      longitude: Number(body.longitude),
    };

    const ayanamsaType: AyanamsaType = body.ayanamsa === 'kp_new' ? 'kp_new' : 'kp_old';
    const planets: PlanetInput[] = Array.isArray(body.planets) ? body.planets : [];

    const result = calculateKPChart(input, ayanamsaType, planets);
    return c.json({ success: true, data: result });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 400);
  }
});

app.get('/api/horary/table', (c) => {
  const table = getHorary249Table();
  return c.json({ success: true, count: table.length, table });
});

export default app;

