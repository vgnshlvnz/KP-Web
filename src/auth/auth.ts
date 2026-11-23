import { betterAuth } from 'better-auth';
import { emailOTP } from 'better-auth/plugins';
import { sendLoginCode, type SendEmailBinding } from './email.js';

/**
 * Login for KP-Web (#127): a 6-digit code sent by email (Better Auth `emailOTP`), no passwords.
 * A new address creates its account on first sign-in. The marketing notice and the optional opt-in
 * (owner decision on #127: notice plus a separate unticked checkbox) are stored on the user.
 *
 * The instance is built per request from the Worker's bindings, so nothing reads `cloudflare:workers`
 * at module load and the same code runs in vitest with `node:sqlite`.
 */

/** Bump when the marketing notice wording on public/login.html changes; it is stored with each opt-in. */
export const MARKETING_NOTICE_VERSION = '2026-11-24';

/** Hosts the auth base URL may be built from. Requests from any other host are refused by Better Auth. */
export const AUTH_ALLOWED_HOSTS = ['kp-web-cloudflare.*.workers.dev', 'localhost', 'localhost:*', '127.0.0.1:*'];

/** A D1 binding in the Worker; a `node:sqlite` DatabaseSync in tests. Better Auth detects which. */
export type AuthDatabase = object;

export interface AuthEnv {
  DB?: AuthDatabase;
  EMAIL?: SendEmailBinding;
  BETTER_AUTH_SECRET?: string;
  AUTH_EMAIL_FROM?: string;
}

/** True when the bindings and the secret sign-in needs are present. Without them the gate fails closed. */
export function authConfigured(env: AuthEnv | undefined): env is Required<Pick<AuthEnv, 'DB' | 'BETTER_AUTH_SECRET'>> & AuthEnv {
  return Boolean(env && env.DB && typeof env.BETTER_AUTH_SECRET === 'string' && env.BETTER_AUTH_SECRET.length >= 32);
}

export function createAuth(env: AuthEnv) {
  if (!authConfigured(env)) throw new Error('Sign-in is not configured (DB binding or BETTER_AUTH_SECRET missing).');
  return betterAuth({
    appName: 'KP-Web',
    basePath: '/api/auth',
    baseURL: { allowedHosts: AUTH_ALLOWED_HOSTS },
    secret: env.BETTER_AUTH_SECRET,
    database: env.DB as never,
    telemetry: { enabled: false },
    emailAndPassword: { enabled: false },
    user: {
      additionalFields: {
        // Set by the sign-in request (the unticked checkbox on the login page); only read on account creation.
        marketingOptIn: { type: 'boolean', required: false, defaultValue: false, input: true },
        // Stamped by the server, never by the client.
        marketingOptInAt: { type: 'date', required: false, input: false },
        marketingNoticeVersion: { type: 'string', required: false, input: false },
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const optIn = (user as { marketingOptIn?: unknown }).marketingOptIn === true;
            return {
              data: {
                ...user,
                marketingOptIn: optIn,
                marketingOptInAt: optIn ? new Date() : null,
                marketingNoticeVersion: MARKETING_NOTICE_VERSION,
              },
            };
          },
        },
      },
      session: {
        create: {
          // Keep personal data to what sign-in needs (#14): no IP address or user agent on the session.
          before: async (session) => ({ data: { ...session, ipAddress: null, userAgent: null } }),
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    // In-memory limits do not hold across Worker isolates. The emailOTP plugin adds 3 per 60 s for sending a code.
    rateLimit: { enabled: true, storage: 'database', window: 60, max: 60 },
    advanced: {
      // Cloudflare sets cf-connecting-ip and replaces any client value; used for rate limiting only.
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 600,
        allowedAttempts: 5,
        async sendVerificationOTP({ email, otp, type }) {
          if (type !== 'sign-in') return; // only sign-in codes are offered
          await sendLoginCode(env, email, otp);
        },
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

/**
 * One Better Auth instance per bindings object. In a Worker isolate `env` is the same object on every
 * request, so the instance is built once per isolate instead of on every request (CPU on the free plan).
 */
const instances = new WeakMap<object, Auth>();

export function authFor(env: AuthEnv): Auth {
  let auth = instances.get(env);
  if (!auth) {
    auth = createAuth(env);
    instances.set(env, auth);
  }
  return auth;
}
