import { Hono } from 'hono';
import api from './index.js';
import { authConfigured, authFor, RATE_LIMIT_RETENTION_MS, type AuthEnv } from './auth/auth.js';
import { isPublicPath, loginRedirectFor } from './auth/gate.js';

/**
 * The Worker entry (`wrangler.jsonc` `main`, #127). In order:
 *   1. Better Auth at /api/auth/* (email-code sign-in, session, sign-out);
 *   2. the walled-garden gate (public: login, /match and its two APIs, shared assets; everything else
 *      needs a session, and without the DB binding or the secret it fails closed with 503);
 *   3. the KP API (`src/index.ts`, unchanged, still what the engine and API tests import);
 *   4. the static pages and assets in public/ through the ASSETS binding (`run_worker_first: true`).
 */

interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

export interface ServerEnv extends AuthEnv {
  ASSETS?: AssetsBinding;
}

const server = new Hono<{ Bindings: ServerEnv }>();

const NOT_CONFIGURED = 'Sign-in is not configured on this server.';

/**
 * The Better Auth endpoints the pages use. Any other /api/auth path is a 404 here, before Better Auth runs,
 * so it neither reaches an unused endpoint nor writes a rate-limit row.
 */
export const AUTH_ROUTES: ReadonlySet<string> = new Set([
  'POST /api/auth/email-otp/send-verification-otp',
  'POST /api/auth/sign-in/email-otp',
  'GET /api/auth/get-session',
  'POST /api/auth/sign-out',
  'POST /api/auth/update-user',
]);

server.on(['GET', 'POST'], '/api/auth/*', (c) => {
  if (!AUTH_ROUTES.has(c.req.method + ' ' + c.req.path)) return c.json({ error: 'Route not found: ' + c.req.path }, 404);
  if (!authConfigured(c.env)) return c.json({ error: NOT_CONFIGURED }, 503);
  return authFor(c.env).handler(c.req.raw);
});

server.use('*', async (c, next) => {
  const path = c.req.path;
  if (isPublicPath(path)) return next();
  const isApi = path.startsWith('/api/');
  if (!authConfigured(c.env)) {
    return isApi ? c.json({ error: NOT_CONFIGURED }, 503) : c.text(NOT_CONFIGURED, 503);
  }
  // A Request's headers carry no Host; Better Auth builds its dynamic base URL from it (allowedHosts).
  const headers = new Headers(c.req.raw.headers);
  headers.set('host', new URL(c.req.url).host);
  const session = await authFor(c.env).api.getSession({ headers });
  if (!session) {
    if (isApi) return c.json({ error: 'Sign in required.' }, 401);
    const url = new URL(c.req.url);
    return c.redirect(loginRedirectFor(url.pathname + url.search), 302);
  }
  return next();
});

server.all('/api/*', (c) => api.fetch(c.req.raw, c.env));

server.all('*', (c) => {
  if (!c.env.ASSETS) return c.text('Not found', 404);
  return c.env.ASSETS.fetch(c.req.raw);
});

/** The D1 calls the daily cleanup uses. */
interface D1Like {
  prepare(sql: string): { bind(...values: unknown[]): { run(): Promise<unknown> } };
}

/**
 * Daily cleanup (cron in wrangler.jsonc): Better Auth's rate-limit rows are keyed by client IP and path and are
 * never deleted by Better Auth itself. Rows older than RATE_LIMIT_RETENTION_MS are no longer needed for any limit.
 */
export async function deleteOldRateLimitRows(env: ServerEnv, now = Date.now()): Promise<void> {
  const db = env.DB as D1Like | undefined;
  if (!db || typeof db.prepare !== 'function') return;
  await db.prepare('delete from "rateLimit" where "lastRequest" < ?').bind(now - RATE_LIMIT_RETENTION_MS).run();
}

/** The Hono app, for tests (`app.request`). */
export const app = server;

export default {
  fetch: server.fetch,
  async scheduled(_controller: unknown, env: ServerEnv): Promise<void> {
    await deleteOldRateLimitRows(env);
  },
};
