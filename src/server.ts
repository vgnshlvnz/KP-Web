import { Hono } from 'hono';
import api from './index.js';
import { authConfigured, authFor, type AuthEnv } from './auth/auth.js';
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

server.on(['GET', 'POST'], '/api/auth/*', (c) => {
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

export default server;
