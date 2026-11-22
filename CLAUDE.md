# KP-Web — instructions for Claude Code

KP (Krishnamurti Paddhati) astrology web app. TypeScript, deployed as a Cloudflare Worker with Wrangler.
Correctness of the calculation engine comes before features, UI polish, or speed.

## Commands

```bash
npm ci                 # install (run once per worktree)
npm run typecheck      # tsc --noEmit — must pass
npm test               # vitest run — must pass
npx wrangler dev       # local server; never run `wrangler deploy`
```

## Current state (as of 21 Nov 2026, `build/integration` @ 6f21469) — build fixed, one app

The two parallel stacks are merged into one. `npm run typecheck` and `npm test` are green on a clean `npm ci`
(all tests on vitest, importing from `src/`).

- **One entrypoint:** `src/index.ts` (Hono), matching `wrangler.jsonc`. `public/index.html` is served as static assets.
  Routes: `GET /api/health`, `/api/chart/sample`, `/api/horary/table`, `/api/horary-table`, `/api/ayanamsa`;
  `POST /api/chart/cusps`, `/api/chart/calculate`, `/api/calculate`, `/api/horary`.
- **One engine, `src/engine/*`:** `astronomy.ts` (ayanamsa, nutation, obliquity, sidereal time), `ephemeris.ts`
  (planets on `astronomy-engine`), `placidus.ts`, `kp-lords.ts`, `significators.ts`, `house-assignment.ts`, `chart-wheels.ts`,
  `dasha.ts`, `ruling-planets.ts`, `horary.ts`, `ayanamsa-defs.ts`, one types module `types.ts`, and `index.ts`
  (`calculateChart`, `calculateKPChart`). The old Stack B files (`src/worker.ts`, `src/types.ts`, `src/ephemeris/*`,
  `src/houses/*`, `src/kp/*`) are deleted; what they uniquely provided is ported and tested.
- **Fixed conventions** (owner decisions on #29) are constants in `src/engine/conventions.ts`, not options: mean node only,
  no outer planets, Porphyry fallback with a visible `polar_fallback` warning (horary at polar latitude throws),
  sunrise = upper limb with standard refraction, dasha year 365.2425 days, near-boundary threshold 60 arcsec.
- **Ayanamsa:** twelve explicit ids in `src/engine/ayanamsa-defs.ts`: `kp_straight_line_adjusted` (KPSTLA, first),
  `kp_straight_line`, `kp_ayanamsa` (KP-Qt formulas), `kp_old`,
  `kp_new`, `lahiri`, `raman`, `fagan_bradley`, `yukteshwar`, `jn_bhasin`, `usha_shashi`, `nil`. KP-Qt's
  "User Defined" is not ported (it is `SE_SIDM_USER` with no formula). All except KPSTLA and the two KP-Qt calendar formulas are
  defined as Swiss Ephemeris defines them; KPSTLA follows the owner's formula (#29: T x 50.2388475" / 3600, T from 291 AD),
  and its definition is final (#29): zero point 291-01-01 0h UT Julian, 365.25-day year, no nutation (true = mean). The UI
  preselects KP New (`DEFAULT_AYANAMSA_SELECTION`, #22). The API has **no default and no fallback**: `calculateChart`, `calculateKPChart`,
  `calculateAyanamsa`, `calculateEphemeris` and every API route require it; missing or unknown is an error (HTTP 400).
- **Accuracy of `astronomy-engine` vs Swiss Ephemeris 2.10.03** (audit, #53; local comparison only, SE is not a dependency):
  mean ayanamsa 0.0002″, Sun 0.90″, Moon 4.37″, Mercury to Saturn up to 10.21″ (Saturn 2026), mean node 0.23″, Placidus
  cusps up to 0.10″. A 10″ error flips the sub-sub lord for about 1.7% of positions (about 0.3% at the mean residual),
  which is why charts carry `near_sub_boundary` warnings. Tolerances are pinned in `test/*-reference.test.ts`; never loosen them.

**Open owner decisions — keep as explicit options with `TODO(#NN)`, do not pick defaults:**

| Issue | Decision | Where it applies |
|---|---|---|
| #22 | decided (owner, #29): KP New is the UI's default selection (`DEFAULT_AYANAMSA_SELECTION`); the API requires an explicit ayanamsa. KPSTLA is final, no nutation (#29). #59 and #60 closed with it; #61 (labelling) is still open | `AyanamsaMode` and `ChartCalculationOptions.ayanamsa` in `src/engine/types.ts`; `calculateAyanamsa` in `src/engine/astronomy.ts`; `requireAyanamsa` in `src/index.ts` |
| #23 | Rahu/Ketu agent rule set | `NodeAgentRuleSet` in `types.ts`; `calculateFourLevelSignificators` in `significators.ts`; `ENGINE_CONFIG.nodeAgentRuleSet` in `src/index.ts` (interim `'none'`, owner answer on #29) |
| #24 | ruling-planet set | `RulingPlanetSet` in `types.ts`; `calculateRulingPlanets` in `ruling-planets.ts`; `ENGINE_CONFIG.rulingPlanetSet` in `src/index.ts` |

#25 (Swiss Ephemeris licence) is still open, but the engine is `astronomy-engine`, as recorded in `docs/licensing.md`.
Other open items are marked `TODO(#29 Qn)` in the code (Q10 UI contract, Q16 which boundary flag the UI shows).

**Open UI issue:** `public/index.html` reads response fields that no API version returns (`julianDate`, `formattedDms`,
`assignedHouse`, …) and still asks the user to paste planet longitudes. It is **not** fixed; the owner will design the UI/API
contract later (#29 answer 10). See #68. `src/client/html.ts` was deleted in #68: nothing imported it,
and it called `/api/places/search`, `/api/timezone/offset` and `/api/charts/validate-input`, which do not exist.
Wired in by #12 (`locations-select`): `src/core/timezone.ts` and `src/core/locations.ts`. The page selects Country then Place
from `src/data/locations.ts`, generated from the owner's `locations.db` by `scripts/import-locations.py`; the server
resolves coordinates, zone and the historical UTC offset from `locationId`. `src/core/validation.ts` is also used.
Not wired into the app: `src/core/{places,storage}.ts`, `src/data/cities.ts`.

## Target state

- One entrypoint: `src/index.ts` (Hono), matching `wrangler.jsonc`.
- One engine, one types module, one Placidus, one lords module. No duplicates left behind.
- All tests on vitest, importing from `src/`.
- `npm run typecheck` and `npm test` both green on a clean `npm ci`.

## Rules that hold for every task

- **KP correctness is the product.** Never change a calculation result to make a test pass. If a test and the code disagree, find out which is right (cite the reference value and where it came from) and say so.
- Ayanamsa is an explicit choice from the supported list (KP Straight Line (Adjusted), KP Old, KP New, Lahiri, Raman, Fagan-Bradley, Yukteshwar, J.N. Bhasin, Usha-Shashi, Nil — owner, #29). The UI preselects KP New (#22). KP Straight Line (Adjusted) is final and has no nutation (#29). **The API never falls back: a request without an ayanamsa is rejected.**
- Horary lagna is the **start** of the chosen sub, not the midpoint (midpoint only behind an explicit toggle).
- Day lord for ruling planets changes at **sunrise**, not midnight.
- A planet's house comes from Placidus cusps, not its sign.
- Open rule decisions (#23, #24) are made by the repo owner: do not pick defaults for them; keep them as explicit config with a `TODO(#NN)` comment. #22 is decided (owner, #29): KP New is the UI's default selection; the API requires an explicit ayanamsa.
- Do not delete a module until everything it uniquely provides has been ported and is covered by a test.
- Don't add dependencies beyond `astronomy-engine` without asking. No native/C++ addons — the code must run in Workers V8 isolates.
- Never run `wrangler deploy`, `git push --force`, or anything that publishes. Pushing `build/*` branches and opening PRs into `build/integration` is part of the workflow. Never push to `main`.

## GitHub is the communication channel

**Read `docs/build-fix/GITHUB-PROTOCOL.md` before doing anything.** Summary:
- Plans, status, blockers, findings, reviews, reports and approvals all go on GitHub (`gh` CLI, repo `vgnshlvnz/KP-Web`) — issues, comments, PRs. The terminal reply is only a short pointer to what you posted.
- Every body you post starts with `<!-- kp-agent:<your-agent-name> -->` and `**[<your-agent-name>]**`. Comments without that marker are from the owner and are instructions.
- Post with `--body-file`, never long inline `--body`.
- One tracking issue for the effort; one issue per work package; one PR per package into `build/integration` with `Closes #N`.
- Before working, read your package issue **and all its comments**, plus decision issues #22–#25. Owner comments override the plan.
- Real calculation disagreements become their own `engine-mismatch` issue.
- Only the owner merges into `main`. Agents merge into `build/integration` only via `scripts/gh-merge-package.sh`.

## Git worktrees

Parallel work happens in git worktrees under `../kp-web-wt/<name>`, one `build/<name>` branch each, created from `origin/build/integration` with `scripts/worktrees.sh new <name>`.
- Each worktree needs its own `npm ci`.
- In a worktree, prefix every shell command with `cd <absolute worktree path> &&` — the shell does not keep the directory between calls.
- Only touch the files your package owns. If you need a change outside them, post a **Blocked** comment on your package issue instead of editing.
- Commit on your branch, push with `scripts/worktrees.sh push <name>`, open the PR with `gh pr create --base build/integration`. Never merge your own PR.
- To pick up newer integration work: `scripts/worktrees.sh update <name>` (merge, not rebase — no force-pushes).

## Commit messages

`area: what changed` — e.g. `build: add astronomy-engine dependency`, `engine: port dasha to unified types`.
Reference the issue when there is one (`Refs #4`).
