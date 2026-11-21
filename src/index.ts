import { Hono } from 'hono';
import { INDEX_HTML } from './client/html';
import { searchPlaces } from './core/places';
import { defaultStorage } from './core/storage';
import { computeTimezoneOffset, isValidTimezone } from './core/timezone';
import { BirthInputPayload, validateBirthInput, validateDate, validateTime } from './core/validation';

export const app = new Hono<{ Bindings: { ASSETS?: Fetcher } }>();

// Web UI: Serve interactive birth data input interface
app.get('/', async (c) => {
  if (c.env?.ASSETS) {
    try {
      const assetRes = await c.env.ASSETS.fetch(c.req.raw);
      if (assetRes.status < 400) return assetRes;
    } catch {
      // Fallback to embedded HTML
    }
  }
  return c.html(INDEX_HTML);
});

// API: Health check
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    engine: 'KP-Web',
    version: '1.0.0',
    runtime: 'Cloudflare Worker',
    timestamp: new Date().toISOString(),
  });
});

// API: Place search (resolves to latitude, longitude, and IANA timezone)
app.get('/api/places/search', async (c) => {
  const q = c.req.query('q') || '';
  const limitStr = c.req.query('limit');
  const parsedLimit = limitStr ? parseInt(limitStr, 10) : 10;
  const limit = Math.min(Math.max(1, Number.isInteger(parsedLimit) ? parsedLimit : 10), 50);

  if (!q.trim()) {
    return c.json({ query: q, results: [] });
  }

  const results = await searchPlaces(q, { limit, preferOnline: false });
  return c.json({
    query: q,
    count: results.length,
    results,
    source: 'GeoNames Open Data (CC-BY 4.0)',
  });
});

// API: Compute UTC offset for local date/time and timezone
app.post('/api/timezone/offset', async (c) => {
  try {
    const body = await c.req.json<{
      year: number;
      month: number;
      day: number;
      hours: number;
      minutes: number;
      seconds: number;
      timezone: string;
    }>();

    if (!body || !body.timezone) {
      return c.json({ error: 'Timezone identifier is required.' }, 400);
    }

    if (!isValidTimezone(body.timezone)) {
      return c.json({ error: `Invalid IANA timezone: "${body.timezone}"` }, 400);
    }

    const dateErr = validateDate(body.year, body.month, body.day);
    if (dateErr) {
      return c.json({ error: dateErr }, 400);
    }

    const timeErr = validateTime(body.hours, body.minutes, body.seconds);
    if (timeErr) {
      return c.json({ error: timeErr }, 400);
    }

    const result = computeTimezoneOffset(
      body.year,
      body.month,
      body.day,
      body.hours,
      body.minutes,
      body.seconds,
      body.timezone
    );

    return c.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error calculating timezone offset';
    return c.json({ error: message }, 400);
  }
});

// API: Validate birth data input and store raw/resolved input for recomputation
app.post('/api/charts/validate-input', async (c) => {
  try {
    const payload = await c.req.json<BirthInputPayload>();
    const result = validateBirthInput(payload);

    if (!result.valid) {
      return c.json(
        {
          valid: false,
          errors: result.errors,
          message: 'Invalid or incomplete birth data input. Please correct the highlighted errors.',
        },
        400
      );
    }

    // Save chart input for later recomputation
    const chart = await defaultStorage.save(result.resolvedChartInput!);

    return c.json({
      valid: true,
      message: 'Birth data successfully validated and stored for chart calculation.',
      chart,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error validating birth data';
    return c.json({ valid: false, error: message }, 400);
  }
});

// API: Retrieve stored chart input by ID
app.get('/api/charts/:id', async (c) => {
  const id = c.req.param('id');
  const chart = await defaultStorage.get(id);

  if (!chart) {
    return c.json({ error: 'Chart record not found' }, 404);
  }

  return c.json(chart);
});

export default app;
