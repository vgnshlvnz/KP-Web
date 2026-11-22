import { describe, expect, it } from 'vitest';
import page from '../public/animate.html?raw';
import { stepTime } from '../src/client/animate-step';

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
