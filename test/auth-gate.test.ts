/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import server, { type ServerEnv } from '../src/server.js';
import { MARKETING_NOTICE_VERSION } from '../src/auth/auth.js';
import { isPublicPath, loginRedirectFor, safeNextPath } from '../src/auth/gate.js';
import { authMigrationSql } from '../scripts/auth-migration.js';

/**
 * Login and walled garden (#127), end to end through the Worker entry, on an in-memory SQLite database
 * with the committed migration applied (the same SQL the owner applies to D1), a fake Email Service
 * binding that records what would be sent, and a fake ASSETS binding.
 */

const MIGRATION = readFileSync(fileURLToPath(new URL('../migrations/0001_better_auth.sql', import.meta.url).href), 'utf8');
const SECRET = 'test-secret-0123456789abcdefghijklmnopqrstuvwxyz';
const ORIGIN = 'http://localhost';

interface Sent { to: string; from: string; subject: string; text: string }

function makeEnv(overrides: Partial<ServerEnv> = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec(MIGRATION);
  const sent: Sent[] = [];
  const env: ServerEnv = {
    DB: db,
    BETTER_AUTH_SECRET: SECRET,
    AUTH_EMAIL_FROM: 'KP-Web <login@example.test>',
    EMAIL: { send: async (m) => { sent.push(m as Sent); return { messageId: String(sent.length) }; } },
    ASSETS: { fetch: async (req: Request) => new Response('asset:' + new URL(req.url).pathname, { status: 200 }) },
    ...overrides,
  };
  return { env, db, sent };
}

/** A different client IP per call keeps Better Auth's rate limit out of tests that are not about it. */
let ip = 0;
function nextIp() { ip += 1; return `203.0.113.${ip % 250}`; }

function get(env: ServerEnv, path: string, cookie?: string, clientIp = nextIp()) {
  const headers: Record<string, string> = { 'cf-connecting-ip': clientIp };
  if (cookie) headers.cookie = cookie;
  return server.request(path, { headers, redirect: 'manual' }, env);
}

function post(env: ServerEnv, path: string, body: unknown, cookie?: string, clientIp = nextIp()) {
  const headers: Record<string, string> = { 'content-type': 'application/json', origin: ORIGIN, 'cf-connecting-ip': clientIp };
  if (cookie) headers.cookie = cookie;
  return server.request(path, { method: 'POST', headers, body: JSON.stringify(body) }, env);
}

function cookiesFrom(res: Response): string {
  return res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
}

async function signIn(env: ServerEnv, sent: Sent[], email: string, extra: Record<string, unknown> = {}) {
  const send = await post(env, '/api/auth/email-otp/send-verification-otp', { email, type: 'sign-in' });
  expect(send.status).toBe(200);
  const mail = sent.filter((m) => m.to === email).at(-1)!;
  const code = /\b(\d{6})\b/.exec(mail.text)![1];
  const res = await post(env, '/api/auth/sign-in/email-otp', { email, otp: code, ...extra });
  expect(res.status).toBe(200);
  return cookiesFrom(res);
}

const CHART = { year: 1980, month: 1, day: 1, hour: 10, minute: 0, second: 0, locationId: 1096, ayanamsa: 'kp_new' };

describe('walled garden: signed out', () => {
  it('pages that need a login redirect to /login with the page to return to', async () => {
    const { env } = makeEnv();
    for (const path of ['/', '/index.html', '/animate.html', '/animate?x=1']) {
      const res = await get(env, path);
      expect(res.status, path).toBe(302);
      expect(res.headers.get('location'), path).toBe(loginRedirectFor(path));
    }
  });

  it('APIs that need a login return 401 JSON', async () => {
    const { env } = makeEnv();
    expect((await post(env, '/api/calculate', CHART)).status).toBe(401);
    const res = await post(env, '/api/chart/calculate', CHART);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Sign in required.' });
    expect((await get(env, '/api/chart/sample')).status).toBe(401);
  });

  it('the login page, the free /match with its two APIs, shared assets and health stay public', async () => {
    const { env } = makeEnv();
    for (const path of ['/login', '/login.html', '/match', '/match.html', '/vendor/material-web-2.5.0.js', '/styles/kp-m3-tokens.css', '/favicon.ico']) {
      const res = await get(env, path);
      expect(res.status, path).toBe(200);
      expect(await res.text(), path).toBe('asset:' + path);
    }
    expect((await get(env, '/api/health')).status).toBe(200);
    expect((await get(env, '/api/locations')).status).toBe(200);
    const match = await post(env, '/api/match', {
      ayanamsa: 'kp_new',
      boy: { year: 1990, month: 5, day: 10, hour: 8, minute: 15, second: 0, locationId: 1096 },
      girl: { year: 1992, month: 3, day: 11, hour: 6, minute: 14, second: 0, locationId: 1096 },
      checkingDate: { year: 2030, month: 2, day: 1 },
    });
    expect(match.status).toBe(200);
  });

  it('fails closed: without the DB binding or the secret, gated paths are 503 and never served', async () => {
    for (const overrides of [{ DB: undefined }, { BETTER_AUTH_SECRET: undefined }, { BETTER_AUTH_SECRET: 'short' }]) {
      const { env } = makeEnv(overrides);
      expect((await get(env, '/')).status).toBe(503);
      expect((await post(env, '/api/calculate', CHART)).status).toBe(503);
      expect((await post(env, '/api/auth/email-otp/send-verification-otp', { email: 'a@example.test', type: 'sign-in' })).status).toBe(503);
      // Public pages still work, so /match stays free even then.
      expect((await get(env, '/match.html')).status).toBe(200);
    }
  });
});

describe('email-code sign-in (Better Auth emailOTP)', () => {
  it('sends a 6-digit code, refuses a wrong one, and the right one opens the app', async () => {
    const { env, sent } = makeEnv();
    const email = 'reader@example.test';
    const send = await post(env, '/api/auth/email-otp/send-verification-otp', { email, type: 'sign-in' });
    expect(send.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(email);
    expect(sent[0].from).toBe('KP-Web <login@example.test>');
    expect(sent[0].subject).toBe('Your KP-Web login code');
    const code = /\b(\d{6})\b/.exec(sent[0].text)![1];

    const wrong = await post(env, '/api/auth/sign-in/email-otp', { email, otp: code === '000000' ? '111111' : '000000' });
    expect(wrong.status).toBeGreaterThanOrEqual(400);
    expect(cookiesFrom(wrong)).not.toContain('session_token');

    const ok = await post(env, '/api/auth/sign-in/email-otp', { email, otp: code });
    expect(ok.status).toBe(200);
    const cookie = cookiesFrom(ok);
    expect(cookie).toContain('better-auth.session_token=');

    const page = await get(env, '/', cookie);
    expect(page.status).toBe(200);
    expect(await page.text()).toBe('asset:/');
    expect((await post(env, '/api/calculate', CHART, cookie)).status).toBe(200);

    const session = await get(env, '/api/auth/get-session', cookie);
    const body = (await session.json()) as { user: { email: string } };
    expect(body.user.email).toBe(email);

    const out = await post(env, '/api/auth/sign-out', {}, cookie);
    expect(out.status).toBe(200);
    const afterOut = cookiesFrom(out) || cookie;
    expect((await get(env, '/', afterOut.includes('session_token=;') ? '' : afterOut.replace(/better-auth\.session_data=[^;]*;?\s*/, ''))).status).toBe(302);
  });

  it('a code is single use', async () => {
    const { env, sent } = makeEnv();
    const email = 'once@example.test';
    await post(env, '/api/auth/email-otp/send-verification-otp', { email, type: 'sign-in' });
    const code = /\b(\d{6})\b/.exec(sent[0].text)![1];
    expect((await post(env, '/api/auth/sign-in/email-otp', { email, otp: code })).status).toBe(200);
    expect((await post(env, '/api/auth/sign-in/email-otp', { email, otp: code })).status).toBeGreaterThanOrEqual(400);
  });

  it('rate-limits sending codes from one address (3 per minute, from the emailOTP plugin)', async () => {
    const { env } = makeEnv();
    const clientIp = '198.51.100.7';
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      statuses.push((await post(env, '/api/auth/email-otp/send-verification-otp', { email: 'busy@example.test', type: 'sign-in' }, undefined, clientIp)).status);
    }
    expect(statuses.slice(0, 3)).toEqual([200, 200, 200]);
    expect(statuses.slice(3)).toEqual([429, 429]);
  });
});

describe('marketing notice and optional opt-in (owner decision on #127)', () => {
  type Row = { email: string; marketingOptIn: number | null; marketingOptInAt: string | null; marketingNoticeVersion: string | null };
  const row = (db: DatabaseSync, email: string) =>
    db.prepare('select email, marketingOptIn, marketingOptInAt, marketingNoticeVersion from "user" where email = ?').get(email) as Row;

  it('ticked: stored true, with the time and the notice version', async () => {
    const { env, db, sent } = makeEnv();
    const before = Date.now();
    await signIn(env, sent, 'yes@example.test', { marketingOptIn: true });
    const r = row(db, 'yes@example.test');
    expect(r.marketingOptIn).toBe(1);
    expect(r.marketingNoticeVersion).toBe(MARKETING_NOTICE_VERSION);
    expect(r.marketingOptInAt).not.toBeNull();
    expect(Math.abs(new Date(r.marketingOptInAt!).getTime() - before)).toBeLessThan(60_000);
  });

  it('not ticked: stored false with no time, and sign-in still works', async () => {
    const { env, db, sent } = makeEnv();
    const cookie = await signIn(env, sent, 'no@example.test');
    expect((await get(env, '/', cookie)).status).toBe(200);
    const r = row(db, 'no@example.test');
    expect(r.marketingOptIn).toBe(0);
    expect(r.marketingOptInAt).toBeNull();
    expect(r.marketingNoticeVersion).toBe(MARKETING_NOTICE_VERSION);
  });

  it('the client cannot set the opt-in time or the notice version itself', async () => {
    const { env, db, sent } = makeEnv();
    const res = await post(env, '/api/auth/email-otp/send-verification-otp', { email: 'forge@example.test', type: 'sign-in' });
    expect(res.status).toBe(200);
    const code = /\b(\d{6})\b/.exec(sent[0].text)![1];
    const signInRes = await post(env, '/api/auth/sign-in/email-otp', {
      email: 'forge@example.test', otp: code, marketingOptInAt: '2000-01-01T00:00:00.000Z', marketingNoticeVersion: 'forged',
    });
    // Better Auth refuses input: false fields outright, so no forged value can be stored.
    if (signInRes.status === 200) {
      const r = row(db, 'forge@example.test');
      expect(r.marketingOptInAt).toBeNull();
      expect(r.marketingNoticeVersion).toBe(MARKETING_NOTICE_VERSION);
    } else {
      expect(signInRes.status).toBe(400);
      expect(row(db, 'forge@example.test')).toBeUndefined();
    }
  });

  it('sessions store no IP address or user agent (#14)', async () => {
    const { env, db, sent } = makeEnv();
    await signIn(env, sent, 'private@example.test');
    const s = db.prepare('select ipAddress, userAgent from "session"').all() as Array<{ ipAddress: unknown; userAgent: unknown }>;
    expect(s.length).toBe(1);
    expect(s[0]).toEqual({ ipAddress: null, userAgent: null });
  });
});

describe('gate helpers', () => {
  it('public paths are exactly the login page, /match, its two APIs, health, assets and auth', () => {
    expect(isPublicPath('/match')).toBe(true);
    expect(isPublicPath('/api/auth/get-session')).toBe(true);
    expect(isPublicPath('/')).toBe(false);
    expect(isPublicPath('/index.html')).toBe(false);
    expect(isPublicPath('/animate.html')).toBe(false);
    expect(isPublicPath('/api/calculate')).toBe(false);
    expect(isPublicPath('/api/horary')).toBe(false);
    expect(isPublicPath('/matchmaker')).toBe(false);
    expect(isPublicPath('/match.html/../index.html')).toBe(false);
  });

  it('next only ever names a path on this site', () => {
    expect(safeNextPath('/animate.html?x=1')).toBe('/animate.html?x=1');
    for (const bad of ['//evil.example', 'https://evil.example', '/\\evil.example', 'evil', '', null, undefined, '/\u0000x']) {
      expect(safeNextPath(bad as string)).toBe('/');
    }
  });
});

describe('migrations/0001_better_auth.sql', () => {
  it('is exactly what Better Auth plans for the current auth config (regenerate with npm run auth:migration)', async () => {
    expect(MIGRATION).toBe(await authMigrationSql());
  });
});
