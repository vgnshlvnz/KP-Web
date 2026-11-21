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

## Current state (as of 21 Nov 2026, commit 1ba2a10) — the build is broken

The repo contains **two parallel apps** that were generated separately:

| | Stack A (live) | Stack B (orphaned) |
|---|---|---|
| Entrypoint | `src/index.ts` (Hono) — `wrangler.jsonc` `main` | `src/worker.ts` (plain fetch handler) |
| Ephemeris | `src/engine/astronomy.ts` (hand-rolled, no deps) | `src/ephemeris/jpl-ephemeris.ts` (`astronomy-engine`) + `src/ephemeris/ayanamsa.ts` |
| Houses | `src/engine/placidus.ts` | `src/houses/placidus.ts` |
| Lords | `src/engine/kp-lords.ts` | `src/kp/sub-lords.ts` |
| Significators | `src/engine/significators.ts` | `src/kp/significators.ts` |
| Only in this stack | `house-assignment.ts`, `chart-wheels.ts` | `dasha.ts`, `ruling-planets.ts`, `horary.ts`, `horary-table.ts`, `engine.ts` |
| Types | `src/engine/types.ts` | `src/types.ts` |
| Tests | vitest, import from `src/` — passing | `node:test` + `node:assert`, import from `../dist/` — failing |

Not wired into either app: `src/core/*` (timezone, places, validation, storage), `src/data/cities.ts`, `src/client/html.ts`.
`public/index.html` is the UI served as static assets; it calls `POST /api/chart/calculate`.

Known breakages:
1. `astronomy-engine` is imported by Stack B but missing from `package.json`.
2. Five test files (`ayanamsa`, `ephemeris`, `horary`, `significators-and-dasha`, `worker`) use `node:test` and import from `dist/`, which is never built (`noEmit: true`, `dist/` is gitignored).
3. `tsc --noEmit` fails on the above.

`docs/licensing.md` records the decision to use NASA JPL / `astronomy-engine` instead of Swiss Ephemeris.
That makes Stack B's ephemeris the intended one — but its accuracy is **claimed, not measured**.

## Target state

- One entrypoint: `src/index.ts` (Hono), matching `wrangler.jsonc`.
- One engine, one types module, one Placidus, one lords module. No duplicates left behind.
- All tests on vitest, importing from `src/`.
- `npm run typecheck` and `npm test` both green on a clean `npm ci`.

## Rules that hold for every task

- **KP correctness is the product.** Never change a calculation result to make a test pass. If a test and the code disagree, find out which is right (cite the reference value and where it came from) and say so.
- KP Old and KP New ayanamsa only. **Never fall back to Lahiri silently.**
- Horary lagna is the **start** of the chosen sub, not the midpoint (midpoint only behind an explicit toggle).
- Day lord for ruling planets changes at **sunrise**, not midnight.
- A planet's house comes from Placidus cusps, not its sign.
- Open rule decisions (issues #22, #23, #24) are made by the repo owner. Do not pick defaults for them; keep them as explicit config with a `TODO(#NN)` comment.
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
