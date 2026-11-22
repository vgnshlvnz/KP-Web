/**
 * KP-Web HTTP API: the only entrypoint (`wrangler.jsonc` `main`), on the unified engine in
 * `src/engine`. Work package `entrypoint` (#66).
 *
 * Routes
 *   GET  /api/health           status, engine and the supported ayanamsa ids
 *   GET  /api/ayanamsa         the supported ayanamsas and their value at `?date=`
 *   GET  /api/horary/table     the 1-249 table, `{ success, count, table }`      (UI contract, unchanged)
 *   GET  /api/horary-table     the 1-249 table, bare; `?number=` for one entry
 *   GET  /api/chart/sample     sample inputs                                      (UI contract, unchanged)
 *   POST /api/chart/cusps      Placidus cusps, `{ success, data }`                (UI contract, unchanged)
 *   POST /api/chart/calculate  cusps + planets + significators, `{ success, data }` (UI contract, unchanged)
 *   POST /api/calculate        natal chart, `calculateChart`, bare result
 *   POST /api/horary           horary chart, `calculateHoraryChart`, bare result
 *
 * The two `/api/chart/*` routes and `/api/horary/table` keep the request and response shapes that
 * `public/index.html` reads: the UI contract is open (#29, owner answer 10: "keep open, design
 * later"). The routes ported from Stack B (`/api/calculate`, `/api/horary`, `/api/horary-table`,
 * `/api/ayanamsa`) return the engine result bare and report errors as `{ error }`.
 *
 * Errors: invalid input is 400 `{ error }`; `PolarLatitudeError` (horary) is 422; anything else is
 * 500 with a generic message and no stack trace. The `/api/chart/*` routes also carry
 * `success: false`, which the UI checks.
 *
 * Open owner decisions, never defaulted in the engine:
 *   - #22 decided (owner, #29): KP New is the UI's default selection; the API requires an explicit ayanamsa.
 *     `ayanamsa` is REQUIRED in every request and validated with `validateAyanamsa` (the ten supported ids).
 *     Missing or unknown is 400. `DEFAULT_AYANAMSA_SELECTION` is only reported, for the UI to preselect.
 *   - TODO(#23), TODO(#24): the two other engine options are set once, in `ENGINE_CONFIG`.
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
  calculateAyanamsa,
  calculateChart,
  calculateHoraryChart,
  calculateKPChart,
  calculateNutation,
  formatDms,
  getHorary249Table,
  getHoraryEntry,
  PolarLatitudeError,
  toJulianDate,
} from './engine/index.js';
import type {
  AyanamsaMode,
  ChartCalculationOptions,
  DateTimeLocation,
  NodeAgentRuleSet,
  PlanetInput,
  RulingPlanetSet,
} from './engine/index.js';
import { AYANAMSA_LABELS, AYANAMSA_MODES, DEFAULT_AYANAMSA_SELECTION } from './engine/ayanamsa-defs.js';
import { validateAyanamsa } from './core/validation.js';

// ---------------------------------------------------------------------------
// Engine configuration: the two decisions that are still open (#23, #24)
// ---------------------------------------------------------------------------

/**
 * The only place the API picks a value for the still-open engine options (#23, #24). `ayanamsa` is NOT here:
 * it always comes from the request (#22 decided: no API default).
 */
const ENGINE_CONFIG: {
  nodeAgentRuleSet: NodeAgentRuleSet;
  rulingPlanetSet: RulingPlanetSet;
} = {
  // TODO(#23): Rahu/Ketu agent rule set. Owner's interim answer is B, "none" (#29, 2026-11-21 10:56).
  nodeAgentRuleSet: 'none',
  // TODO(#24): ruling-planet membership. Owner answer 3 (#29, 2026-11-21 10:45) keeps the 5-entry
  // list: ascendant star and sign, Moon star and sign, day lord.
  rulingPlanetSet: 'asc_star_sign_moon_star_sign_day_lord',
};

function engineOptions(ayanamsa: AyanamsaMode): ChartCalculationOptions {
  return { ayanamsa, ...ENGINE_CONFIG };
}

// ---------------------------------------------------------------------------
// Request parsing
// ---------------------------------------------------------------------------

/** The request is wrong: 400. */
class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BadRequestError';
  }
}

type Body = Record<string, unknown>;

async function readJsonBody(req: { json(): Promise<unknown> }): Promise<Body> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new BadRequestError('Invalid JSON body.');
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestError('The request body must be a JSON object.');
  }
  return body as Body;
}

/** The ayanamsa is always the caller's explicit choice (#22 decided: KP New is a UI selection only; no API fallback). */
function requireAyanamsa(body: Body): AyanamsaMode {
  const err = validateAyanamsa(body.ayanamsa);
  if (err) throw new BadRequestError(err);
  return body.ayanamsa as AyanamsaMode;
}

/** A finite number, or a non-empty numeric string (the legacy routes coerced with `Number()`). */
function numberField(body: Body, key: string, missing: number | undefined): number {
  const raw = body[key];
  if (raw === undefined || raw === null) {
    if (missing !== undefined) return missing;
    throw new BadRequestError(`"${key}" is required.`);
  }
  const n = typeof raw === 'number' || (typeof raw === 'string' && raw.trim() !== '') ? Number(raw) : NaN;
  if (!Number.isFinite(n)) {
    throw new BadRequestError(`"${key}" must be a finite number, got ${JSON.stringify(raw)}.`);
  }
  return n;
}

/**
 * Civil date, time and place. `utcOffsetHours` handling is the one difference between the routes:
 * `'required'` (the new routes): a missing offset is 400, never silently UTC.
 * `'legacy_utc'` (`/api/chart/*`, whose UI does not send it): a missing offset is treated as UTC.
 */
function parseDateTimeLocation(body: Body, offset: 'required' | 'legacy_utc'): DateTimeLocation {
  const year = numberField(body, 'year', undefined);
  const month = numberField(body, 'month', undefined);
  const day = numberField(body, 'day', undefined);
  const hour = numberField(body, 'hour', undefined);
  const minute = numberField(body, 'minute', undefined);
  const second = numberField(body, 'second', 0);
  const latitude = numberField(body, 'latitude', undefined);
  const longitude = numberField(body, 'longitude', undefined);
  // TODO(#29 Q10): on the legacy routes a missing offset is treated as UTC (what they did before).
  // The new routes require it; how the UI sends the offset is part of the postponed UI/API design.
  const utcOffsetHours = numberField(body, 'utcOffsetHours', offset === 'legacy_utc' ? 0 : undefined);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    throw new BadRequestError('"year", "month" and "day" must be integers.');
  }
  const dt = new Date(0);
  dt.setUTCFullYear(year, month - 1, day);
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) {
    throw new BadRequestError(`Not a calendar date: ${year}-${month}-${day}.`);
  }
  if (hour < 0 || hour >= 24 || minute < 0 || minute >= 60 || second < 0 || second >= 60) {
    throw new BadRequestError(`Not a clock time: ${hour}:${minute}:${second}.`);
  }
  if (latitude < -90 || latitude > 90) {
    throw new BadRequestError(`"latitude" must be between -90 and 90, got ${latitude}.`);
  }
  if (longitude < -180 || longitude > 180) {
    throw new BadRequestError(`"longitude" must be between -180 and 180, got ${longitude}.`);
  }
  if (Math.abs(utcOffsetHours) > 24) {
    throw new BadRequestError(`"utcOffsetHours" must be between -24 and 24, got ${utcOffsetHours}.`);
  }
  return { year, month, day, hour, minute, second, utcOffsetHours, latitude, longitude };
}

function parsePlanets(body: Body): PlanetInput[] {
  if (body.planets === undefined) return [];
  if (!Array.isArray(body.planets)) {
    throw new BadRequestError('"planets" must be an array of { name, longitude }.');
  }
  return body.planets.map((p: unknown, i: number) => {
    const q = p as { name?: unknown; longitude?: unknown } | null;
    if (
      q === null ||
      typeof q !== 'object' ||
      typeof q.name !== 'string' ||
      typeof q.longitude !== 'number' ||
      !Number.isFinite(q.longitude)
    ) {
      throw new BadRequestError(`"planets[${i}]" must be { name: string, longitude: number }.`);
    }
    return p as PlanetInput;
  });
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const app = new Hono();

// Ported from Stack B's worker (same policy: any origin, GET/POST, Content-Type).
app.use(
  '/api/*',
  cors({ origin: '*', allowMethods: ['GET', 'POST', 'OPTIONS'], allowHeaders: ['Content-Type'] })
);

/** The UI's routes carry `success`, which `public/index.html` checks; the others are `{ error }`. */
function errorBody(path: string, message: string): Record<string, unknown> {
  return path.startsWith('/api/chart/') || path === '/api/horary/table'
    ? { success: false, error: message }
    : { error: message };
}

app.notFound((c) => c.json(errorBody(c.req.path, `Route not found: ${c.req.path}`), 404));

app.onError((err, c) => {
  if (err instanceof BadRequestError || err instanceof RangeError) {
    return c.json(errorBody(c.req.path, err.message), 400);
  }
  if (err instanceof PolarLatitudeError) {
    return c.json(errorBody(c.req.path, err.message), 422);
  }
  // Not the caller's fault. Log it server-side; the response carries no message from the error and no stack.
  console.error('Unhandled error:', err);
  return c.json(errorBody(c.req.path, 'An internal error occurred while processing the request.'), 500);
});

app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'KP-Web',
    engine: 'astronomy-engine',
    licensing: 'astronomy-engine is MIT; see THIRD_PARTY_LICENSES.md',
    runtime: 'Cloudflare Workers',
    // #22 decided (owner, #29): KP New is the UI's default selection; the API requires an explicit ayanamsa.
    // `defaultSelection` is for the UI's preselected option only; a request without `ayanamsa` is 400.
    defaultSelection: DEFAULT_AYANAMSA_SELECTION,
    ayanamsas: AYANAMSA_MODES,
    endpoints: [
      'GET  /api/health',
      'GET  /api/ayanamsa',
      'GET  /api/horary/table',
      'GET  /api/horary-table',
      'GET  /api/chart/sample',
      'POST /api/chart/cusps',
      'POST /api/chart/calculate',
      'POST /api/calculate',
      'POST /api/horary',
    ],
  });
});

// Sample inputs for the UI. These are inputs only: the planet longitudes this list used to carry
// ("verified against Swiss Ephemeris") were invented, were never returned by the route, and are removed.
// Reference longitudes live in docs/build-fix/audit.md Appendix A and test/chart-reference.test.ts.
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
    ayanamsa: 'kp_old' as AyanamsaMode,
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
    ayanamsa: 'kp_old' as AyanamsaMode,
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

/**
 * The two `/api/chart/*` routes share one implementation (they did before). Both go through
 * `calculateKPChart`, which at polar latitudes returns Porphyry cusps with `isPolarFallback: true`
 * and a `polar_fallback` warning (200). `/api/chart/cusps` therefore never needs the bare-cusp
 * `calculateCuspsFromARMC`, which throws `PolarLatitudeError` because it cannot carry a warning.
 */
async function legacyChart(req: { json(): Promise<unknown> }) {
  const body = await readJsonBody(req);
  const ayanamsa = requireAyanamsa(body); // required, no default (#22 decided: UI preselect only)
  const input = parseDateTimeLocation(body, 'legacy_utc');
  const planets = parsePlanets(body);
  return calculateKPChart(input, ayanamsa, planets);
}

app.post('/api/chart/cusps', async (c) => {
  return c.json({ success: true, data: await legacyChart(c.req) });
});

app.post('/api/chart/calculate', async (c) => {
  return c.json({ success: true, data: await legacyChart(c.req) });
});

app.get('/api/horary/table', (c) => {
  const table = getHorary249Table();
  return c.json({ success: true, count: table.length, table });
});

// ---- ported from Stack B ---------------------------------------------------

app.get('/api/horary-table', (c) => {
  const numParam = c.req.query('number');
  if (numParam !== undefined) {
    const num = /^\d+$/.test(numParam) ? Number(numParam) : NaN;
    if (!Number.isInteger(num) || num < 1 || num > 249) {
      throw new BadRequestError('"number" must be an integer between 1 and 249.');
    }
    return c.json(getHoraryEntry(num));
  }
  return c.json(getHorary249Table());
});

app.get('/api/ayanamsa', (c) => {
  const dateParam = c.req.query('date');
  let date = new Date();
  if (dateParam !== undefined) {
    date = new Date(dateParam);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestError('Invalid "date". Use ISO format YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ.');
    }
  }
  const jd = toJulianDate(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds()
  );
  const dPsi = calculateNutation(jd).dPsi;

  // Every supported mode. `defaultSelection` is the UI's preselected option, not an API fallback
  // (#22 decided, owner, #29: the API still requires an explicit ayanamsa). "mean" is the ayanamsa of the date;
  // "true" adds the nutation in longitude (except KPSTLA and Nil, where true = mean), the value
  // subtracted from tropical longitudes.
  const ayanamsas = AYANAMSA_MODES.map((id) => {
    const a = calculateAyanamsa(jd, id, dPsi);
    return {
      id,
      label: AYANAMSA_LABELS[id],
      meanDegrees: a.meanAyanamsa,
      trueDegrees: a.trueAyanamsa,
      meanDms: formatDms(a.meanAyanamsa, true),
    };
  });
  return c.json({
    dateUtc: date.toISOString(),
    julianDay: jd,
    nutationInLongitudeDegrees: dPsi,
    defaultSelection: DEFAULT_AYANAMSA_SELECTION,
    ayanamsas,
  });
});

/**
 * Natal or event chart: `calculateChart`. Flat body, the fields of `DateTimeLocation` plus
 * `ayanamsa`: year, month, day, hour, minute, second (optional, 0), utcOffsetHours (REQUIRED, no
 * silent UTC), latitude, longitude, ayanamsa (REQUIRED, #22 decided: no API default).
 */
app.post('/api/calculate', async (c) => {
  const body = await readJsonBody(c.req);
  const ayanamsa = requireAyanamsa(body);
  const input = parseDateTimeLocation(body, 'required');
  return c.json(calculateChart(input, engineOptions(ayanamsa)));
});

/**
 * KP horary chart: `calculateHoraryChart`. Same flat fields as `/api/calculate` for the instant and
 * place of the question (no "now" default: they are required), plus `horaryNumber` (integer 1-249)
 * and the optional boolean `useSubMidpoint` (default false: the lagna is the START of the sub, the
 * KP rule; true is the explicit midpoint toggle). At polar latitudes: 422.
 */
app.post('/api/horary', async (c) => {
  const body = await readJsonBody(c.req);
  const ayanamsa = requireAyanamsa(body);
  const horaryNumber = body.horaryNumber;
  if (typeof horaryNumber !== 'number' || !Number.isInteger(horaryNumber) || horaryNumber < 1 || horaryNumber > 249) {
    throw new BadRequestError('"horaryNumber" must be an integer between 1 and 249.');
  }
  if (body.useSubMidpoint !== undefined && typeof body.useSubMidpoint !== 'boolean') {
    throw new BadRequestError('"useSubMidpoint" must be a boolean when given.');
  }
  const questionTime = parseDateTimeLocation(body, 'required');
  const result = calculateHoraryChart(
    { questionTime, horaryNumber, useSubMidpoint: body.useSubMidpoint === true },
    engineOptions(ayanamsa)
  );
  return c.json(result);
});

export default app;
