import { describe, expect, it } from 'vitest';
import page from '../public/animate.html?raw';
import { stepTime } from '../src/client/animate-step';
import app from '../src/index.js';
import { AYANAMSA_LABELS, AYANAMSA_MODES, DEFAULT_AYANAMSA_SELECTION } from '../src/engine/ayanamsa-defs.js';

/** Inline scripts only (no `src`), as [source, 1-based line of the tag]. Mirrors ui-page-integrity.test.ts. */
function inlineScripts(html: string): Array<{ source: string; line: number }> {
  const scripts: Array<{ source: string; line: number }> = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc\s*=/.test(m[1])) continue;
    if (/\btype\s*=\s*["'](?!module|text\/javascript)/i.test(m[1])) continue;
    scripts.push({ source: m[2], line: html.slice(0, m.index).split('\n').length });
  }
  return scripts;
}

describe('public/animate.html integrity', () => {
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
    const missing = [...wanted].filter((id) => page.split(`id="${id}"`).length - 1 !== 1);
    expect(missing).toEqual([]);
  });
});

describe('public/animate.html inline stepTime mirrors src/client/animate-step.ts', () => {
  // Extract just the mirror block (not the whole inline script, which runs DOM code on
  // invocation) and evaluate it in isolation, so a future edit to one copy without the other
  // fails this test instead of silently diverging in the browser.
  const start = page.indexOf('const ELAPSED_SECONDS_PER_UNIT');
  const end = page.indexOf('const el = (id) =>');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Could not locate the stepTime mirror block in animate.html');
  }
  const mirrorSource = page.slice(start, end);
  const inlineStepTime = new Function(`${mirrorSource}\nreturn stepTime;`)() as typeof stepTime;

  const cases: Array<[Parameters<typeof stepTime>[0], number, Parameters<typeof stepTime>[2]]> = [
    [{ year: 2024, month: 6, day: 15, hour: 10, minute: 30, second: 45 }, 10, 'seconds'],
    [{ year: 2024, month: 6, day: 15, hour: 23, minute: 0, second: 0 }, 2, 'hours'],
    [{ year: 2024, month: 1, day: 31, hour: 6, minute: 0, second: 0 }, 1, 'months'],
    [{ year: 2024, month: 2, day: 29, hour: 9, minute: 15, second: 0 }, 1, 'years'],
  ];

  it.each(cases)('matches the module for %o + %d %s', (from, amount, type) => {
    expect(inlineStepTime(from, amount, type)).toEqual(stepTime(from, amount, type));
  });
});

describe('public/animate.html request contract (current main)', () => {
  it('lists exactly the supported ayanamsas, with the same labels, and never a default of its own in the request', () => {
    const block = page.slice(page.indexOf('const AYANAMSA_OPTIONS = ['), page.indexOf('const DEFAULT_AYANAMSA_SELECTION'));
    const listed = [...block.matchAll(/\['([a-z_]+)',\s*'([^']+)'\]/g)].map((m) => [m[1], m[2]]);
    expect(listed).toEqual(AYANAMSA_MODES.map((id) => [id, AYANAMSA_LABELS[id]]));
  });

  it('preselects KP New (#22 decided on #29) and sends the explicit ayanamsa choice', () => {
    expect(DEFAULT_AYANAMSA_SELECTION).toBe('kp_new');
    expect(page).toContain("const DEFAULT_AYANAMSA_SELECTION = 'kp_new';");
    expect(page).toContain('const ayanamsa = ayanamsaSel.value;');
    expect(page).toContain('{ year, month, day, hour, minute, second, locationId, ayanamsa }');
    // A saved value is only restored when it is a known id.
    expect(page).toContain('AYANAMSA_OPTIONS.some(([value]) => value === saved.ayanamsa)');
  });

  it('names the place by locationId from /api/locations and has no manual latitude, longitude or offset', () => {
    expect(page).toContain("fetch('/api/locations')");
    expect(page).toContain('locationId');
    expect(page).not.toMatch(/id="inp(Lat|Lon|Offset|Tz|Timezone)/i);
    expect(page).not.toContain('utcOffsetHours:');
    expect(page).not.toContain('/api/places/search');
    expect(page).not.toContain('/api/timezone/offset');
  });

  it('offers the repeated-time choice and shows the API error message instead of a generic one', () => {
    expect(page).toContain('id="inpAmbiguous"');
    expect(page).toContain('payload.ambiguousTime = ambiguousTime');
    expect(page).toContain('result.json.error');
    expect(page).not.toContain("setStatus('Chart computation failed.', true)");
  });

  const post = (path: string, body: unknown) =>
    app.request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('every response field the page reads is returned by the API (Delhi 1947, KP New)', async () => {
    const body = { year: 1947, month: 8, day: 15, hour: 0, minute: 5, second: 0, locationId: 916, ayanamsa: 'kp_new' };
    const calc = (await (await post('/api/calculate', body)).json()) as {
      planets: Array<{ name: string; longitude: number }>;
    };
    expect(calc.planets.length).toBeGreaterThan(0);
    for (const p of calc.planets) {
      expect(typeof p.name).toBe('string');
      expect(Number.isFinite(p.longitude)).toBe(true);
    }
    const res = await post('/api/chart/calculate', {
      ...body,
      planets: calc.planets.map((p) => ({ name: p.name, longitude: p.longitude })),
    });
    expect(res.status).toBe(200);
    const chart = (await res.json()) as { success: boolean; data: any };
    expect(chart.success).toBe(true);

    for (const p of chart.data.planets) {
      for (const k of ['name', 'formatted', 'signName', 'starLord', 'subLord']) expect(p[k], `planet.${k}`).toBeTruthy();
    }
    const south = chart.data.chartWheels.southIndian;
    expect(south).toHaveLength(12);
    for (const box of south) {
      expect(typeof box.signIndex).toBe('number');
      expect(typeof box.signName).toBe('string');
      for (const c of box.cusps) {
        expect(typeof c.house).toBe('number');
        expect(typeof c.formatted).toBe('string');
      }
      for (const p of box.planets) {
        expect(typeof p.name).toBe('string');
        expect(typeof p.house).toBe('number');
      }
    }
    const north = chart.data.chartWheels.northIndian;
    expect(north).toHaveLength(12);
    for (const h of north) {
      expect(typeof h.house).toBe('number');
      expect(typeof h.signName).toBe('string');
      expect(typeof h.cuspFormatted).toBe('string');
      for (const p of h.planets) expect(typeof p.name).toBe('string');
    }
    for (const field of [
      'p.name',
      'p.formatted',
      'p.signName',
      'p.starLord',
      'p.subLord',
      'box.signName',
      'c.house',
      'c.formatted',
      'p.house',
      'h.house',
      'h.signName',
      'h.cuspFormatted',
    ]) {
      expect(page, field).toContain(field);
    }
  });

  it('a DST gap and a repeated clock time are 400 with a message the page shows, until earlier/later is chosen', async () => {
    const locations = (await (await app.request('/api/locations')).json()) as {
      countries: Array<{ places: Array<{ id: number; timezone: string }> }>;
    };
    const ny = locations.countries.flatMap((c) => c.places).find((p) => p.timezone === 'America/New_York');
    expect(ny).toBeDefined();
    const base = { second: 0, locationId: ny!.id, ayanamsa: 'kp_new' };

    for (const path of ['/api/calculate', '/api/chart/calculate']) {
      const gap = await post(path, { ...base, year: 2024, month: 3, day: 10, hour: 2, minute: 30 });
      expect(gap.status).toBe(400);
      expect(((await gap.json()) as { error: string }).error).toMatch(/does not exist/);

      const twice = { ...base, year: 2024, month: 11, day: 3, hour: 1, minute: 30 };
      const ambiguous = await post(path, twice);
      expect(ambiguous.status).toBe(400);
      expect(((await ambiguous.json()) as { error: string }).error).toMatch(/earlier.*later/);

      for (const ambiguousTime of ['earlier', 'later']) {
        expect((await post(path, { ...twice, ambiguousTime })).status).toBe(200);
      }
    }
  });
});
