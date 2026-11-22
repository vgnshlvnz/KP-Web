import { describe, expect, it } from 'vitest';
import page from '../public/index.html?raw';

/**
 * Structural checks on `public/index.html` (#89). The merge dd36422 left two
 * `const positions` declarations in the Calculate handler, so the script did not
 * parse, no listener was attached and the page did nothing, while every
 * string-level test on the page still passed. These checks fail on such a merge.
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

describe('public/index.html integrity', () => {
  const scripts = inlineScripts(page);

  it('has at least one inline script', () => {
    expect(scripts.length).toBeGreaterThan(0);
  });

  it('every inline script parses', () => {
    for (const { source, line } of scripts) {
      // `new Function` compiles the body without running it, so a SyntaxError (for example a
      // repeated `const`) is thrown here. The script is never called.
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

  it('every id the script reads by getElementById exists exactly once', () => {
    const wanted = new Set<string>();
    for (const { source } of scripts) {
      for (const m of source.matchAll(/getElementById\(\s*'([^']+)'\s*\)/g)) wanted.add(m[1]);
    }
    const missing = [...wanted].filter((id) => page.split(`id="${id}"`).length - 1 !== 1);
    expect(missing).toEqual([]);
  });
});
