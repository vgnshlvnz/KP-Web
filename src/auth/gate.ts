/**
 * Walled garden (#127). Everything needs a signed-in session except the login page, the free
 * Horoscope Match (owner decision: /match is freeware) with the two APIs it calls, the static
 * assets every page loads, and the auth API itself. The gate fails closed.
 */

/** Exact public paths. `/match` and `/login` are served by assets as match.html and login.html. */
export const PUBLIC_PATHS: ReadonlySet<string> = new Set([
  '/login',
  '/login.html',
  '/match',
  '/match.html',
  '/favicon.ico',
  '/api/health',
  '/api/match',
  '/api/locations',
]);

/** Public path prefixes: shared static assets and the Better Auth routes. */
export const PUBLIC_PREFIXES: readonly string[] = ['/vendor/', '/fonts/', '/styles/', '/js/', '/api/auth/'];

export function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.has(path) || PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/**
 * Where to go after signing in. Only a same-site path is accepted (it starts with one `/`, and has no
 * backslash or control characters), so `next` cannot send a user to another site.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (typeof next !== 'string' || next.length === 0 || next.length > 512) return '/';
  if (!next.startsWith('/') || next.startsWith('//') || /[\\\u0000-\u001f]/.test(next)) return '/';
  return next;
}

/** The login URL for a gated page, carrying the page to return to. */
export function loginRedirectFor(pathAndQuery: string): string {
  return '/login?next=' + encodeURIComponent(safeNextPath(pathAndQuery));
}
