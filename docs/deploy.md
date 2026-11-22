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

```bash
npm run dev       # wrangler dev, http://localhost:8787
```

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
`kp-web` (the `name` in `wrangler.jsonc`). On the first deploy wrangler may ask you to register a `workers.dev`
subdomain for your account. When it finishes it prints the URL, of the form:

```
https://kp-web.<your-subdomain>.workers.dev
```

Confirm it:

```bash
curl https://kp-web.<your-subdomain>.workers.dev/api/health
```

That should return JSON with `"status":"ok"`. Then open the three pages in a browser:

- `https://kp-web.<your-subdomain>.workers.dev/` (chart)
- `https://kp-web.<your-subdomain>.workers.dev/match` (horoscope match)
- `https://kp-web.<your-subdomain>.workers.dev/animate` (animated chart)

Check that an unknown API path answers with JSON, not a web page:

```bash
curl -i https://kp-web.<your-subdomain>.workers.dev/api/nope      # 404, {"error":"Route not found: /api/nope"}
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

Workers Logs are also in the Cloudflare dashboard: Workers & Pages, `kp-web`, Observability (`observability` is
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

Size: the bundled Worker is about 206 KB minified (71 KB gzipped). The limit is 3 MB compressed on Free and 10 MB on
Paid. `public/` is 672 KB of static files (self-hosted fonts and Material Web), which do not count against the Worker
size and load nothing from external hosts.

## 9. Custom domain (optional)

Dashboard steps; no code change is needed.

1. Add your domain to Cloudflare (Websites, Add a site) and switch its nameservers as instructed.
2. Workers & Pages, `kp-web`, Settings, Domains & Routes, Add, Custom Domain.
3. Enter the hostname (for example `kp.example.com`). Cloudflare creates the DNS record and the certificate.

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

## 11. Not covered yet

- **CI deploy.** Deploying from GitHub Actions is blocked by billing, so deploys are manual (`npm run deploy`).
- **Persistence.** Saved charts, accounts and consent records have no storage yet (issues #12, #14, #17). The Worker is
  stateless today.
- **Open owner decisions.** Rules still waiting on the owner (issues #23 and #24 in the code) are explicit options in the
  engine, not defaults. They are not blockers for a deploy, but results for those rules may change when decided.
- **Content-Security-Policy**, **restricting CORS**, and a **rate limit** are later options.
