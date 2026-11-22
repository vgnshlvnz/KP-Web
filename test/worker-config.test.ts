/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import wranglerRaw from '../wrangler.jsonc?raw';
import headersRaw from '../public/_headers?raw';
import packageRaw from '../package.json?raw';
import app from '../src/index.js';

/**
 * Cloudflare Workers readiness (work package `workers-ready`, #110): config and docs only, no engine logic.
 * `wrangler.jsonc` is JSONC, so comments are stripped before parsing; string contents are left alone.
 */
function parseJsonc(text: string): any {
  const stripped = text.replace(/"(?:\\.|[^"\\])*"|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (m) => (m.startsWith('"') ? m : ''));
  return JSON.parse(stripped);
}

describe('wrangler.jsonc', () => {
  const config = parseJsonc(wranglerRaw);

  it('points at the Hono entrypoint and the static assets directory', () => {
    expect(config.name).toBe('kp-web');
    expect(config.main).toBe('src/index.ts');
    expect(config.assets.directory).toBe('./public');
  });

  it('turns observability (Workers Logs) on', () => {
    expect(config.observability).toEqual({ enabled: true });
  });

  it('sends /api/* to the Worker first, so no asset can shadow an API path', () => {
    expect(config.assets.run_worker_first).toEqual(['/api/*']);
  });

  it('does not enable nodejs_compat: nothing reachable from the entrypoint uses a Node API', () => {
    expect(config.compatibility_flags ?? []).not.toContain('nodejs_compat');
  });

  it('has a compatibility date', () => {
    expect(config.compatibility_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('package.json deploy scripts', () => {
  const scripts = JSON.parse(packageRaw).scripts as Record<string, string>;

  it('deploy runs wrangler deploy and predeploy runs typecheck and tests first', () => {
    expect(scripts.deploy).toBe('wrangler deploy');
    expect(scripts.predeploy).toBe('npm run typecheck && npm test');
  });
});

describe('public/_headers', () => {
  /** Header lines under the `/*` rule, lower-cased names. */
  const headers = new Map<string, string>();
  for (const line of headersRaw.split('\n')) {
    const m = /^\s+([A-Za-z-]+):\s*(.+?)\s*$/.exec(line);
    if (m) headers.set(m[1].toLowerCase(), m[2]);
  }

  it('applies to every path', () => {
    expect(headersRaw).toMatch(/^\/\*\s*$/m);
  });

  it('carries the four security headers', () => {
    expect(headers.get('x-content-type-options')).toBe('nosniff');
    expect(headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(headers.get('x-frame-options')).toBe('DENY');
    expect(headers.get('permissions-policy')).toBe('camera=(), microphone=(), geolocation=()');
  });

  it('has no Content-Security-Policy yet (the pages use inline scripts)', () => {
    expect(headers.has('content-security-policy')).toBe(false);
  });
});

describe('unknown /api paths', () => {
  it.each([
    ['GET', '/api/nope'],
    ['POST', '/api/nope'],
    ['GET', '/api/chart/nope'],
    ['GET', '/api/'],
  ])('%s %s is a JSON 404, not an HTML page', async (method, path) => {
    const res = await app.request(path, { method });
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toMatch(/^application\/json/);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('Route not found');
  });
});
