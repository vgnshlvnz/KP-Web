import { describe, expect, it } from 'vitest';
import page from '../public/match.html?raw';
import indexPage from '../public/index.html?raw';
import animatePage from '../public/animate.html?raw';
import app from '../src/index.js';
import { AYANAMSA_LABELS, AYANAMSA_MODES, DEFAULT_AYANAMSA_SELECTION } from '../src/engine/ayanamsa-defs.js';

/**
 * Structural and contract checks on `public/match.html` (#105), the page for `POST /api/match` (#103).
 * Mirrors `animate-page-integrity.test.ts` and `ui-page-integrity.test.ts`. The last block calls the real
 * Hono app, so the page cannot read a field the API does not return (the drift that #68 was about).
 */

/** Inline scripts only (no `src`), as [source, 1-based line of the tag]. */
function inlineScripts(html: string): Array<{ source: string; line: number }> {
  const scripts: Array<{ source: string; line: number }> = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc\s*=/.test(m[1])) continue;
    if (/\btype\s*=\s*["'](?!module|text\/javascript)/i.test(m[1])) continue;
    scripts.push({ source: m[2], line: html.slice(0, m.index).split('\n').length });
  }
  return scripts;
}

/** The page source between two markers (the first occurrence of each), for evaluating a helper in isolation. */
function between(from: string, to: string): string {
  const start = page.indexOf(from);
  const end = page.indexOf(to, start);
  if (start === -1 || end === -1) throw new Error(`Could not find "${from}" ... "${to}" in match.html`);
  return page.slice(start, end);
}

describe('public/match.html integrity', () => {
  const scripts = inlineScripts(page);

  it('has at least one inline script', () => {
    expect(scripts.length).toBeGreaterThan(0);
  });

  it('every inline script parses', () => {
    for (const { source, line } of scripts) {
      expect(() => new Function(source), `inline script at line ${line}`).not.toThrow();
    }
  });

  it('has no duplicate id attributes', () => {
    const seen = new Map<string, number>();
    for (const m of page.matchAll(/<[a-zA-Z][\w-]*\b[^>]*?\sid="([^"]+)"/g)) {
      seen.set(m[1], (seen.get(m[1]) ?? 0) + 1);
    }
    const duplicates = [...seen].filter(([, n]) => n > 1).map(([id, n]) => `${id} x${n}`);
    expect(duplicates).toEqual([]);
  });

  it('every id the script reads by getElementById or el() exists exactly once', () => {
    const wanted = new Set<string>();
    for (const { source } of scripts) {
      for (const m of source.matchAll(/getElementById\(\s*'([^']+)'\s*\)/g)) wanted.add(m[1]);
      for (const m of source.matchAll(/\bel\(\s*'([^']+)'\s*\)/g)) wanted.add(m[1]);
    }
    expect(wanted.size).toBeGreaterThan(10);
    const missing = [...wanted].filter((id) => page.split(`id="${id}"`).length - 1 !== 1);
    expect(missing).toEqual([]);
  });

  it('every id in the PERSON_IDS table (read through el(ids.x)) exists exactly once, for both people', () => {
    const block = between('const PERSON_IDS = {', 'const PERSON_LABEL');
    const ids = [...block.matchAll(/:\s*'([A-Za-z]+)'/g)].map((m) => m[1]);
    // 10 roles x 2 people.
    expect(ids).toHaveLength(20);
    expect(new Set(ids).size).toBe(20);
    expect(ids.filter((id) => id.startsWith('boy'))).toHaveLength(10);
    expect(ids.filter((id) => id.startsWith('girl'))).toHaveLength(10);
    const missing = ids.filter((id) => page.split(`id="${id}"`).length - 1 !== 1);
    expect(missing).toEqual([]);
  });

  it('is linked from index.html and animate.html', () => {
    for (const html of [indexPage, animatePage]) {
      expect(html).toMatch(/<a href="\/match\.html"[^>]*>Horoscope Match<\/a>/);
    }
  });
});

describe('public/match.html request contract', () => {
  it('lists exactly the supported ayanamsas, with the same labels', () => {
    const block = between('const AYANAMSA_OPTIONS = [', 'const DEFAULT_AYANAMSA_SELECTION');
    const listed = [...block.matchAll(/\['([a-z_]+)',\s*'([^']+)'\]/g)].map((m) => [m[1], m[2]]);
    expect(listed).toEqual(AYANAMSA_MODES.map((id) => [id, AYANAMSA_LABELS[id]]));
  });

  it('preselects KP New and only KP New (#22 decided on #29); the request always sends the explicit choice', () => {
    expect(DEFAULT_AYANAMSA_SELECTION).toBe('kp_new');
    expect(page).toContain("const DEFAULT_AYANAMSA_SELECTION = 'kp_new';");
    expect(page).toContain('ayanamsaSel.value = DEFAULT_AYANAMSA_SELECTION;');
    // The select is filled from AYANAMSA_OPTIONS, so no option is written in the HTML, and none is marked `selected`.
    const select = page.slice(page.indexOf('<md-outlined-select id="inpAyanamsa"'), page.indexOf('</md-outlined-select>', page.indexOf('id="inpAyanamsa"')));
    expect(select).not.toContain('md-select-option');
    expect(between('const AYANAMSA_OPTIONS = [', 'const DEFAULT_AYANAMSA_SELECTION')).not.toContain('selected');
    expect(page).toContain('const ayanamsa = ayanamsaSel.value;');
    expect(page).toContain('payload: { ayanamsa, boy, girl, checkingDate }');
    expect(page).toContain("AYANAMSA_OPTIONS.some(([value]) => value === ayanamsa)");
  });

  it('names each place by locationId from /api/locations, with no manual coordinates or offset', () => {
    expect(page).toContain("fetch('/api/locations')");
    expect(page).toContain("fetch('/api/match'");
    expect(page).toContain('locationId');
    expect(page).not.toMatch(/<md-outlined-(text-field|select)[^>]*\sid="[^"]*(Lat|Lon|Offset|Tz|Timezone)/i);
    expect(page).not.toContain('utcOffsetHours:');
    expect(page).not.toContain('latitude:');
    expect(page).not.toContain('/api/places/search');
    expect(page).not.toContain('/api/timezone/offset');
  });

  it('never sends the optional name: the request builder does not read it', () => {
    const builder = between('function readPerson', 'function readMatchRequest');
    expect(builder).not.toMatch(/name/i);
    const request = between('function readMatchRequest', '// ---- Ambiguous-time');
    expect(request).not.toMatch(/name/i);
  });

  it('stores nothing and makes no external request', () => {
    const code = inlineScripts(page).map((s) => s.source).join('\n');
    expect(code).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie|caches\./);
    expect(code).not.toMatch(/\bnavigator\.sendBeacon|\bXMLHttpRequest|\bWebSocket|\bimportScripts/);
    // The only fetch targets are this origin's API.
    expect([...code.matchAll(/fetch\(\s*'([^']+)'/g)].map((m) => m[1])).toEqual(['/api/locations', '/api/match']);
    // Page-level URLs: only the local stylesheet and component bundle (index.html loads the same two).
    const urls = [...page.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]).filter((u) => /^(https?:)?\/\//.test(u));
    expect(urls).toEqual([]);
    expect(page).toContain('href="/styles/kp-m3-tokens.css"');
    expect(page).toContain('src="/vendor/material-web-2.5.0.js"');
  });

  it('offers the repeated-time choice for each birth and for the checking date', () => {
    for (const id of ['boyAmbiguous', 'girlAmbiguous', 'chkAmbiguous']) expect(page).toContain(`id="${id}"`);
    expect(page).toContain('person.ambiguousTime = ambiguousTime');
    expect(page).toContain('checkingDate.ambiguousTime = chkAmbiguous');
  });

  it('builds payload keys the API accepts, in shapes the API accepts (a request as the page builds it returns 200)', async () => {
    const res = await post('/api/match', {
      ayanamsa: 'kp_new',
      boy: { year: 1980, month: 9, day: 14, hour: 1, minute: 5, second: 0, locationId: ids.kl },
      girl: { year: 1983, month: 5, day: 31, hour: 17, minute: 35, second: 0, locationId: ids.kl },
      checkingDate: { year: 1986, month: 2, day: 1 },
    });
    expect(res.status).toBe(200);
  });
});

describe('public/match.html number display', () => {
  // Evaluate just the helper, not the whole script (which runs DOM code on load).
  const trimNum = new Function(`${between('function trimNum', 'const marks')}\nreturn trimNum;`)() as (
    value: unknown,
    digits: number
  ) => string;

  it('shows at most 2 decimals with trailing zeros trimmed, so floating-point noise never reaches the screen', () => {
    expect(trimNum(100.00000000000001, 2)).toBe('100');
    expect(trimNum(99.99999999999999, 2)).toBe('100');
    expect(trimNum(100, 2)).toBe('100');
    expect(trimNum(0, 2)).toBe('0');
    expect(trimNum(50, 2)).toBe('50');
    expect(trimNum(83.33333333333334, 2)).toBe('83.33');
    expect(trimNum(33.333333333333336, 2)).toBe('33.33');
    expect(trimNum(416.6666666666667, 2)).toBe('416.67');
    expect(trimNum(59.523809523809526, 2)).toBe('59.52');
    expect(trimNum(66.5, 2)).toBe('66.5');
    expect(trimNum(-0.001, 2)).toBe('0');
  });

  it('shows a dash, not a made-up number, for a missing or non-numeric value', () => {
    expect(trimNum(undefined, 2)).toBe('—');
    expect(trimNum(null, 2)).toBe('—');
    expect(trimNum(NaN, 2)).toBe('—');
    expect(trimNum('abc', 2)).toBe('—');
  });

  it('formats marks, the total and the percentage through the same helper', () => {
    expect(page).toContain('const marks = (value) => trimNum(value, 2);');
    expect(page).toContain("el('resTotal').textContent = marks(data.total);");
    expect(page).toContain("el('resMax').textContent = marks(data.maxTotal);");
    expect(page).toContain("marks(data.totalPercent) + '%'");
    expect(page).toContain("marks(rule.marks) + ' / ' + marks(rule.maxMarks)");
    // No other number formatting of the marks.
    expect(page).not.toMatch(/\b(total|totalPercent|marks|maxMarks)\)?\.toFixed/);
  });
});

// ---------------------------------------------------------------------------
// The page against the real API
// ---------------------------------------------------------------------------

const post = (path: string, body: unknown) =>
  app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

type Place = { id: number; country: string; place: string | null; timezone: string };
const locations = (await (await app.request('/api/locations')).json()) as { countries: Array<{ places: Place[] }> };
const allPlaces = locations.countries.flatMap((c) => c.places);
const klRow = allPlaces.find((p) => p.country === 'Malaysia' && p.place === 'Kuala Lumpur');
const nyRow = allPlaces.find((p) => p.timezone === 'America/New_York');
if (!klRow || !nyRow) throw new Error('Kuala Lumpur and a New York zone place are needed in /api/locations');
const ids = { kl: klRow.id, ny: nyRow.id };

const BOY = { year: 1980, month: 9, day: 14, hour: 1, minute: 5, second: 0 };
const GIRL = { year: 1983, month: 5, day: 31, hour: 17, minute: 35, second: 0 };

type Json = Record<string, any>;
const get = (obj: Json, path: string): unknown => path.split('.').reduce<any>((o, k) => (o === undefined || o === null ? undefined : o[k]), obj);

describe('public/match.html reads only fields POST /api/match returns', () => {
  let byLocation: Json;
  let byCoordinates: Json;

  it('has a real response from the Hono app for a locationId pair and for a coordinates pair', async () => {
    const a = await post('/api/match', {
      ayanamsa: 'kp_new',
      boy: { ...BOY, locationId: ids.kl },
      girl: { ...GIRL, locationId: ids.kl },
      checkingDate: { year: 1986, month: 2, day: 1 },
    });
    expect(a.status).toBe(200);
    byLocation = (await a.json()) as Json;

    const b = await post('/api/match', {
      ayanamsa: 'kp_new',
      boy: { ...BOY, latitude: 5.4, longitude: 100.3, utcOffsetHours: 8 },
      girl: { ...GIRL, latitude: 3.5, longitude: 102.3, utcOffsetHours: 8 },
      checkingDate: { year: 1986, month: 2, day: 1, utcOffsetHours: 8 },
    });
    expect(b.status).toBe(200);
    byCoordinates = (await b.json()) as Json;
  });

  // [the exact text the page uses to read it, the path in the response]. Each page snippet must appear in the
  // page, and each path must exist in the response (a `null` value is a real value, the page shows a dash).
  const reads: Array<[string, string]> = [
    ['data.total', 'total'],
    ['data.maxTotal', 'maxTotal'],
    ['data.totalPercent', 'totalPercent'],
    ['data.checkingUtc', 'checkingUtc'],
    ['data.rules', 'rules'],
    ['rule.id', 'rules.0.id'],
    ['rule.description', 'rules.0.description'],
    ['rule.marks', 'rules.0.marks'],
    ['rule.maxMarks', 'rules.0.maxMarks'],
    ['data.checking', 'checking'],
    ['c.year', 'checking.year'],
    ['c.month', 'checking.month'],
    ['c.day', 'checking.day'],
    ['c.utcOffsetHours', 'checking.utcOffsetHours'],
    ['c.offsetSource', 'checking.offsetSource'],
    ['data.warnings', 'warnings'],
    ['w.message', 'warnings.0.message'],
    ['data.boy', 'boy'],
    ['data.girl', 'girl'],
  ];

  const perPerson: Array<[string, string]> = [
    ['.location', 'location'],
    ['.ascendant', 'ascendant'],
    ['.seventhCuspSub', 'seventhCuspSub'],
    ['.moonStarLord', 'moonStarLord'],
    ['.dayLord', 'dayLord'],
    ['.dashaLordsAtChecking', 'dashaLordsAtChecking'],
    ['.rulingPlanetsList', 'rulingPlanetsList'],
    ['location.place', 'location.place'],
    ['location.country', 'location.country'],
    ['location.latitude', 'location.latitude'],
    ['location.longitude', 'location.longitude'],
    ['location || {}).timezone', 'location.timezone'],
    ['location || {}).utcOffsetHours', 'location.utcOffsetHours'],
    ['location.preIanaReliableCaution', 'location.preIanaReliableCaution'],
    ['t.signLord', 'ascendant.signLord'],
    ['t.starLord', 'ascendant.starLord'],
    ['t.subLord', 'ascendant.subLord'],
    ['t.signLord', 'seventhCuspSub.signLord'],
    ['t.dasha', 'dashaLordsAtChecking.dasha'],
    ['t.bhukti', 'dashaLordsAtChecking.bhukti'],
    ['t.antara', 'dashaLordsAtChecking.antara'],
  ];

  it.each(reads)('the page reads %s, which is in the response at %s', (snippet, path) => {
    expect(page, `page does not contain ${snippet}`).toContain(snippet);
    for (const json of [byLocation, byCoordinates]) {
      expect(get(json, path), `response has no ${path}`).not.toBeUndefined();
    }
  });

  it.each(perPerson)('the page reads %s, which is in the response for the boy and the girl at %s', (snippet, path) => {
    expect(page, `page does not contain ${snippet}`).toContain(snippet);
    for (const json of [byLocation, byCoordinates]) {
      for (const who of ['boy', 'girl']) {
        // `location` is `null` for a person given by coordinates: the page shows a dash for it.
        if (path.startsWith('location.') && json === byCoordinates) {
          expect(json[who].location).toBeNull();
          continue;
        }
        expect(get(json[who], path), `response ${who} has no ${path}`).not.toBeUndefined();
      }
    }
  });

  it('the page reads a rule note only as an optional field: the API sets none today, so the page shows a dash', () => {
    expect(page).toContain("text(rule.note)");
    for (const r of byLocation.rules) expect(r.note === undefined || typeof r.note === 'string').toBe(true);
  });

  it('a person given by coordinates has no resolved place, and the page shows dashes for it', () => {
    expect(byCoordinates.boy.location).toBeNull();
    expect(page).toContain("if (!location) return '—';");
  });

  it('the day lord may be null (no sunrise), and the page shows a dash for it', () => {
    expect(page).toContain("['Day lord', text(boy.dayLord), text(girl.dayLord)]");
    const text = new Function(`${between('const text =', 'function formatFixed')}\nreturn text;`)() as (v: unknown) => string;
    expect(text(null)).toBe('—');
    expect(text('Saturn')).toBe('Saturn');
  });

  it('shows rules 1, 3, 4, 6, 7, 8 and 10 from the response, and 2, 5 and 9 as not computed (owner decision)', () => {
    const omitted = /const OMITTED_RULES = \[([^\]]*)\];/.exec(page);
    expect(omitted).not.toBeNull();
    const omittedIds = omitted![1].split(',').map((s) => Number(s.trim()));
    expect(omittedIds).toEqual([2, 5, 9]);
    const computed = (byLocation.rules as Array<{ id: number }>).map((r) => r.id);
    expect(computed).toEqual([1, 3, 4, 6, 7, 8, 10]);
    expect([...computed, ...omittedIds].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(page).toContain("'not computed (owner decision)'");
    for (const r of byLocation.rules) expect(r.maxMarks).toBe(100);
    expect(byLocation.maxTotal).toBe(700);
  });

  it('knows every offsetSource value the API returns, and the girl by coordinates reports "request"', () => {
    expect(byLocation.checking.offsetSource).toBe('girl_location_at_checking_date');
    expect(byCoordinates.checking.offsetSource).toBe('request');
    const block = between('const OFFSET_SOURCE_TEXT = {', 'function renderResult');
    expect(block).toContain('girl_location_at_checking_date:');
    expect(block).toContain('request:');
  });
});

describe('public/match.html error handling against the real API (DST gap, repeated time, checking date)', () => {
  const affectedBy = new Function(
    `${between('function sameLocalTime', 'function selectFor')}\nreturn affectedBy;`
  )() as (message: string, payload: Json) => string[];

  const base = (boy: Json, checkingDate: Json = { year: 2030, month: 2, day: 1 }) => ({
    ayanamsa: 'kp_new',
    boy: { second: 0, locationId: ids.ny, ...boy },
    girl: { ...GIRL, locationId: ids.kl },
    checkingDate,
  });

  const gap = { year: 2024, month: 3, day: 10, hour: 2, minute: 30 };
  const twice = { year: 2024, month: 11, day: 3, hour: 1, minute: 30 };

  it('a DST gap is 400 with { error }, which the page puts on screen as it is, with no Earlier/Later offered', async () => {
    const res = await post('/api/match', base(gap));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toMatch(/does not exist/);
    expect(page).toContain('(json && json.error)');
    // The page offers Earlier/Later only for the ambiguous message.
    expect(page).toContain('if (!/Ambiguous local time/i.test(message)) return;');
    expect(/Ambiguous local time/i.test(json.error)).toBe(false);
  });

  it('a repeated clock time is 400 with a message the page recognises, and earlier or later resolves it', async () => {
    const res = await post('/api/match', base(twice));
    expect(res.status).toBe(400);
    const { error } = (await res.json()) as { error: string };
    expect(error).toMatch(/earlier.*later/);
    expect(/Ambiguous local time/i.test(error)).toBe(true);
    for (const ambiguousTime of ['earlier', 'later']) {
      expect((await post('/api/match', base({ ...twice, ambiguousTime }))).status).toBe(200);
    }
  });

  it('the page matches the API message to the birth with that local time, and so offers the choice for that person', async () => {
    const req = base(twice);
    const { error } = (await (await post('/api/match', req)).json()) as { error: string };
    expect(affectedBy(error, req)).toEqual(['boy']);

    // The girl's local time is the one that repeats.
    const girlTwice = { ...req, boy: { ...req.boy, ...GIRL, locationId: ids.kl }, girl: { ...twice, second: 0, locationId: ids.ny } };
    const r2 = await post('/api/match', girlTwice);
    const m2 = ((await r2.json()) as { error: string }).error;
    expect(affectedBy(m2, girlTwice)).toEqual(['girl']);

    // No local time in the message matches: no buttons, the message alone is shown.
    expect(affectedBy('Ambiguous local time: nothing parseable', req)).toEqual([]);
  });

  it('a repeated local time at noon on the checking date is attributed to the checking date', () => {
    const payload = {
      boy: { ...BOY, locationId: 1 },
      girl: { ...GIRL, locationId: 1 },
      checkingDate: { year: 2030, month: 6, day: 15 },
    };
    expect(affectedBy('Ambiguous local time: 2030-06-15 12:00:00 occurs twice in timezone "X".', payload)).toEqual(['checking']);
    expect(affectedBy('Ambiguous local time: 2030-06-15 11:00:00 occurs twice in timezone "X".', payload)).toEqual([]);
  });

  it('a checking date before the first dasha period is 400 with a message the page shows', async () => {
    const res = await post('/api/match', base({ ...BOY, locationId: ids.kl }, { year: 1900, month: 3, day: 10 }));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/checking date/i);
  });
});
