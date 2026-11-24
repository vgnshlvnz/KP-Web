# Deploying KP-Web to Cloudflare Workers

KP-Web is one Cloudflare Worker (`src/index.ts`, Hono) that also serves the static pages in `public/`. It needs no
database, no secrets and no bindings. Nothing in this repository has been deployed yet: the steps below are for you to
run, once, from your own machine.

Every command here was checked against `npx wrangler <command> --help` for the wrangler version pinned in
`package-lock.json` (4.166.0).

## 1. Prerequisites

- A Cloudflare account (the free plan is enough to start; see [Limits](#8-limits)).
- Node 22.12 or newer (wrangler 4.166.0 declares `node >= 22.12.0`).
- This repository checked out on the branch you want to publish.

## 2. Install and sign in

```bash
npm ci
npx wrangler login      # opens a browser; log in and allow wrangler
npx wrangler whoami     # shows the account wrangler will deploy to
```

`wrangler login --help` also lists `--device` (a device-code login, useful over SSH or in a container) and
`--browser=false` (print the link instead of opening it).

If `whoami` lists more than one account, check that the one you want is the one you meant to use before you deploy.

## 3. Run it locally

The app is behind a login (section 12). Once, set up the local sign-in database and secret:

```bash
printf 'BETTER_AUTH_SECRET=%s\n' "$(openssl rand -base64 32)" > .dev.vars   # gitignored
npx wrangler d1 migrations apply kp-web-auth --local                          # local database only
```

Then:

```bash
npm run dev       # wrangler dev, http://localhost:8787
```

Locally, sign-in emails are not sent: `wrangler dev` prints each one and writes its text to a file under
`.wrangler/tmp/email/`, where you can read the 6-digit code.

Open `/`, `/match` and `/animate` in a browser, and try:

```bash
curl http://localhost:8787/api/health
```

`wrangler dev` runs the same workerd runtime as production, so it is a good check that the Worker bundles and starts.
It does not contact your Cloudflare account unless you pass `--remote`.

## 4. Pre-deploy checks

`npm run deploy` runs `predeploy` first (`npm run typecheck && npm test`), so a deploy cannot start from a red tree.
To run the checks on their own:

```bash
npm run typecheck
npm test
```

Do not deploy with failing tests. A failing calculation test means a chart would be wrong.

## 5. First deploy

```bash
npm run deploy      # runs predeploy, then `wrangler deploy`
```

`wrangler deploy` bundles `src/index.ts`, uploads the files in `public/` as static assets and publishes the Worker as
`kp-web-cloudflare` (the `name` in `wrangler.jsonc`). On the first deploy wrangler may ask you to register a `workers.dev`
subdomain for your account. When it finishes it prints the URL, of the form:

```
https://kp-web-cloudflare.<your-subdomain>.workers.dev
```

Confirm it:

```bash
curl https://kp-web-cloudflare.<your-subdomain>.workers.dev/api/health
```

That should return JSON with `"status":"ok"`. Then open the three pages in a browser:

- `https://kp-web-cloudflare.<your-subdomain>.workers.dev/` (chart)
- `https://kp-web-cloudflare.<your-subdomain>.workers.dev/match` (horoscope match)
- `https://kp-web-cloudflare.<your-subdomain>.workers.dev/animate` (animated chart)

Check that an unknown API path answers with JSON, not a web page:

```bash
curl -i https://kp-web-cloudflare.<your-subdomain>.workers.dev/api/nope      # 404, {"error":"Route not found: /api/nope"}
```

Later deploys are the same command. `wrangler deploy --help` also lists `--message` and `--tag` to label a version.

### What the configuration does

`wrangler.jsonc`:

- `main: src/index.ts`, `assets.directory: ./public`: the Worker and the static pages.
- `assets.run_worker_first: ["/api/*"]`: every `/api/*` request goes to the Worker first, so an unknown `/api/...` path
  returns the Worker's JSON 404 and never an HTML page. Other paths are served from `public/` first.
- `observability.enabled: true`: turns on Workers Logs (see below).
- No `nodejs_compat` flag. Nothing reachable from the entrypoint uses a Node API; the app was checked under
  `wrangler dev` without the flag (every page and every route). If a future dependency needs a Node API, add
  `"compatibility_flags": ["nodejs_compat"]` back.
- `compatibility_date` pins the runtime behaviour.

`public/_headers` (applied by Workers static assets to the pages and files, not to Worker responses):

```
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
X-Frame-Options: DENY
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

There is no `Content-Security-Policy` yet, because the pages use inline scripts and styles and a CSP would block them.
Adding one means moving the inline code into files or adding hashes or nonces. That is a later option.

`/api/*` responses carry no security headers from `_headers`. They are JSON with no cookies, so the page headers do not
matter for them.

CORS: `/api/*` answers `Access-Control-Allow-Origin: *` (GET, POST, OPTIONS, `Content-Type`). The API has no cookies and
no authentication, so this is safe today. To restrict it to your own site later, change `origin` in the `cors(...)` call
in `src/index.ts`.

`.gitignore` excludes `.dev.vars*` and `.env*`, which is where local secrets would go if one is ever added. None are
needed today.

## 6. Logs

```bash
npx wrangler tail                 # live log stream for the deployed Worker (`wrangler tail --help` lists --format, --status, --method, --search)
```

Workers Logs are also in the Cloudflare dashboard: Workers & Pages, `kp-web-cloudflare`, Observability (`observability` is
enabled in `wrangler.jsonc`). Unhandled errors are logged as `Unhandled error:` by `src/index.ts`; the response itself
never carries a stack trace.

## 7. Roll back

```bash
npx wrangler deployments list     # the 10 most recent deployments, with version ids
npx wrangler rollback <version-id>    # roll back to that version (the id is optional; see `wrangler rollback --help`)
```

`wrangler rollback --help` also takes `--message` (the reason) and `-y` (accept prompts).

## 8. Limits

Measured on a warm Node process with `app.request` (the first, cold request is slower), in milliseconds of CPU per
request:

| Route | Time per request (warm) |
|---|---|
| `POST /api/chart/calculate` | 0.6 ms |
| `GET /api/locations` | 0.8 ms |
| `POST /api/horary` | 3.1 ms |
| `POST /api/match` | 4.2 ms |

The Workers Free plan allows 10 ms of CPU per request, so these fit, but `/api/match` and a cold start are the ones
to watch. The Free plan also has a daily request cap; the paid plan (Workers Paid) raises CPU time and request limits.
Consider it when you see "exceeded CPU" errors in the logs, or traffic near the daily cap. Check Cloudflare's current
limits page for exact figures, because they change.

A signed-out request through the login gate takes about 0.2 ms warm. The first request in a new isolate also builds the
Better Auth instance once (about 34 ms in Node), so watch CPU time in the dashboard after deploying the login.

Size: with Better Auth (#127) the bundled Worker is about 990 KB minified (280 KB gzipped). The limit is 3 MB compressed on Free and 10 MB on
Paid. `public/` is 672 KB of static files (self-hosted fonts and Material Web), which do not count against the Worker
size and load nothing from external hosts.

## 9. Custom domain (optional)

Dashboard steps, plus one config line for sign-in (step 4).

1. Add your domain to Cloudflare (Websites, Add a site) and switch its nameservers as instructed.
2. Workers & Pages, `kp-web-cloudflare`, Settings, Domains & Routes, Add, Custom Domain.
3. Enter the hostname (for example `kp.example.com`). Cloudflare creates the DNS record and the certificate.
4. **Sign-in:** add the hostname to `vars.AUTH_EXTRA_HOSTS` in `wrangler.jsonc` (comma-separated, for example
   `"kp.example.com"`), then commit and deploy. Until then, every gated page and sign-in on that domain fail with a 500,
   because Better Auth only builds URLs for the hosts it allows (`src/auth/auth.ts`).

## 10. Updating locations

`locations.db` is **not** deployed and the app needs no database. `scripts/import-locations.py` generates
`src/data/locations.ts` from the `.db`, and that file is bundled into the Worker together with
`src/data/location-timezones.ts`.

To update the locations:

1. Edit the `.db`.
2. Regenerate the file:

   ```bash
   python3 scripts/import-locations.py /path/to/locations.db
   ```

   Useful flags (from `python3 scripts/import-locations.py --help`): `--check` reports whether the generated file is
   stale and exits 1 if it differs, without writing; `--report` prints the multi-zone rows as a markdown table. The
   script opens the `.db` read-only.
3. Add a zone to `src/data/location-timezones.ts` for any new country or place. The script fails (exit 1) if a row has
   no zone; it never guesses one.
4. Run `npm test`, commit, and redeploy with `npm run deploy`.

Cloudflare D1 (a hosted SQLite database) is an option only if locations must change without a redeploy, or if the list
grows very large. Today, bundling the list is simpler and faster.

## 10a. Deploying from the Cloudflare dashboard (Workers Builds)

If the Worker is connected to this GitHub repo in the dashboard (Workers & Pages, Settings, Build), Cloudflare builds
and deploys on every push to the production branch. Workers Builds uses the **dashboard Worker's name**: it writes that name
into `name` in `wrangler.jsonc` before the build runs. Keep `name` in `wrangler.jsonc` the same as the dashboard Worker
(`kp-web-cloudflare`), so `npm run deploy` from your machine and Git builds update the same Worker, not two.

Build settings: build command `npm run typecheck && npm test` (the tests alone do not type-check), deploy command
`npx wrangler deploy`.

## 11. Not covered yet

- **GitHub Actions deploy.** GitHub Actions is blocked by billing. Deploys run either from your machine (`npm run deploy`)
  or from Cloudflare Workers Builds on a push (section 10a).
- **Saved charts and account deletion.** Accounts exist for sign-in only (section 12). Saved charts, data export and
  account deletion are not built yet (issues #14, #17).
- **Open owner decisions.** Rules still waiting on the owner (issues #23 and #24 in the code) are explicit options in the
  engine, not defaults. They are not blockers for a deploy, but results for those rules may change when decided.
- **Content-Security-Policy**, **restricting CORS**, and a **rate limit** are later options.

## 12. Login and accounts (#127)

Everything except the login page and the free **Horoscope Match** (`/match`) needs a signed-in user. Sign-in is a 6-digit
code sent by email (Better Auth, `emailOTP` plugin). A new email address gets an account on its first sign-in. The sign-in
page says that email addresses may be used for marketing at a later date. Agreeing is a separate, unticked checkbox, and
the answer is stored with its time and the notice version (`marketingOptIn`, `marketingOptInAt`,
`marketingNoticeVersion` on the `user` table).

What runs where:

| Piece | Where |
|---|---|
| Worker entry: auth, then the gate, then the KP API, then the pages | `src/server.ts` (`main` in `wrangler.jsonc`) |
| Better Auth config | `src/auth/auth.ts` |
| Public paths (login, `/match`, `/api/match`, `/api/locations`, health, assets) | `src/auth/gate.ts` |
| Database: users, sessions, codes, rate limits | D1 `kp-web-auth` (binding `DB`), schema `migrations/0001_better_auth.sql` |
| Sending the codes | Cloudflare Email Service (binding `EMAIL`), sender `AUTH_EMAIL_FROM` |

Without the database or the secret, every gated path returns 503 and nothing behind the login is served. `/match` stays
up.

### One-time setup (run these yourself; they change your Cloudflare account)

1. **Create the database** and copy the `database_id` it prints into `d1_databases` in `wrangler.jsonc` (commit it):

   ```bash
   npx wrangler d1 create kp-web-auth
   ```

2. **Create the tables** in the new database:

   ```bash
   npx wrangler d1 migrations apply kp-web-auth --remote
   ```

3. **Set the secret** that signs sessions (a random 32-byte value; keep it out of the repo):

   ```bash
   openssl rand -base64 32 | npx wrangler secret put BETTER_AUTH_SECRET
   ```

4. **Email Service:** in the dashboard, go to Email, Email Service, and onboard the domain you will send from. The domain
   must be on Cloudflare, and onboarding adds its DNS records. Then set `vars.AUTH_EMAIL_FROM` in `wrangler.jsonc` to an
   address on that domain, for example `KP-Web <login@yourdomain.com>`, and commit it. Check Email Service's current
   plan and limits there.

5. **Deploy** (`npm run deploy`, or push to `main` for Workers Builds), then open the site. It should send you to
   `/login`. Sign in with a code, and the pages show "Signed in as …".

Do steps 1 to 4 **before** the first deploy that includes the login, and so before merging it to `main` (Workers
Builds deploys on every push to `main`). Until then, gated pages return 503 ("Sign-in is not configured"). If the
database exists but step 2 was skipped, they return 500 instead.

Email Service: check during onboarding that it sends to any recipient address for this binding (Email Routing's older
`send_email` only sent to verified addresses). A local `wrangler dev` only simulates sending.

### Custom domain

Add it to `vars.AUTH_EXTRA_HOSTS` (section 9, step 4).

### Changing the schema

If the auth config in `src/auth/auth.ts` changes its fields, regenerate the SQL. `test/auth-gate.test.ts` fails until it
matches. Add it as a new numbered migration, and apply it with `--local` and then `--remote`:

```bash
npm run auth:migration   # uses esbuild, which comes with wrangler
```

### Looking at the opt-ins

```bash
npx wrangler d1 execute kp-web-auth --remote --command 'select email, marketingOptInAt from "user" where marketingOptIn = 1'
```

### Withdrawing marketing consent

A signed-in user can change the opt-in with `POST /api/auth/update-user` and `{"marketingOptIn": false}` (or `true`).
The server stamps the change: opting in records `marketingOptInAt`, withdrawing clears it, and both record the notice
version. The client can never set `marketingOptInAt` or `marketingNoticeVersion` itself. There is no button for this
on the pages yet.

### Personal data

- **Sessions:** store no IP address or user agent. After sign-out, a copied session cookie stops working within
  60 seconds (session cookie cache).
- **Client IP (`cf-connecting-ip`):** used for the sign-in rate limits (3 codes a minute). Better Auth stores it, with
  the path, in the D1 `rateLimit` table.
- **Daily cleanup:** a cron (`triggers.crons` in `wrangler.jsonc`, 03:17 UTC) deletes rows older than a day.
  Reading the session on page loads is not rate-limited, so it writes no rows.
