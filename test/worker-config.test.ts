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

  it('points at the Worker entry (auth, gate, API, assets) and the static assets directory', () => {
    // The name is the Worker's name in the Cloudflare account, a deploy choice and not app logic.
    // Workers Builds (Git-connected deploys) writes the dashboard Worker's name into this field before
    // the build runs, so pinning one value fails any build whose Worker has another name. Check it is a
    // valid Worker name instead.
    expect(config.name).toMatch(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/);
    // #127: src/server.ts wraps the KP API (src/index.ts) with Better Auth and the walled-garden gate.
    expect(config.main).toBe('src/server.ts');
    expect(config.assets.directory).toBe('./public');
    expect(config.assets.binding).toBe('ASSETS');
  });

  it('turns observability (Workers Logs) on', () => {
    expect(config.observability).toEqual({ enabled: true });
  });

  it('sends every request to the Worker first, so the gate decides what a signed-out visitor may load (#127)', () => {
    expect(config.assets.run_worker_first).toBe(true);
  });

  it('enables only nodejs_als (AsyncLocalStorage for Better Auth), not full nodejs_compat', () => {
    expect(config.compatibility_flags).toEqual(['nodejs_als']);
  });

  it('binds the auth database, Email Service and the sender address (#127)', () => {
    expect(config.d1_databases).toEqual([
      expect.objectContaining({
        binding: 'DB',
        database_name: 'kp-web-auth',
        // The owner's D1 database (#132).
        database_id: 'a3e860f8-1460-4dc9-88e3-6a192e10208d',
        migrations_dir: 'migrations',
      }),
    ]);
    expect(config.send_email).toEqual([{ name: 'EMAIL' }]);
    // The owner's sender (#132); its domain must be onboarded to Email Service, never a placeholder.
    expect(config.vars.AUTH_EMAIL_FROM).toBe('noreply@vgnshlv.nz');
    expect(typeof config.vars.AUTH_EXTRA_HOSTS).toBe('string');
    expect(config.triggers).toEqual({ crons: ['17 3 * * *'] });
    // The secret is never in the config: it is set with `wrangler secret put BETTER_AUTH_SECRET`.
    expect(wranglerRaw).not.toMatch(/BETTER_AUTH_SECRET"\s*:/);
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
