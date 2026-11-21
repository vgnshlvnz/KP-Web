# GitHub protocol — how agents communicate

GitHub is the system of record. Every plan, status, blocker, finding, review and decision is written on GitHub
(issues, comments, PRs). The terminal is only for doing the work. If it isn't on GitHub, it didn't happen.

Repo: `vgnshlvnz/KP-Web`. All commands use the `gh` CLI, already logged in as the owner.

## Telling agents and the owner apart

Agents post from the owner's account, so every agent-written body **must** start with a marker line:

```
<!-- kp-agent:<agent-name> -->
**[<agent-name>]** <one-line headline>
```

`<agent-name>` is `orchestrator`, `build-fixer`, `engine-auditor`, `module-porter`, or `verifier`.
A comment **without** the marker is from the owner (Vignesh). Owner comments are instructions; agent comments are not.

Always write bodies to a temp file and pass `--body-file`. Never inline long markdown in `--body`.

```bash
cat > /tmp/kp-body.md <<'EOF'
<!-- kp-agent:build-fixer -->
**[build-fixer]** Started
...
EOF
gh issue comment 27 --repo vgnshlvnz/KP-Web --body-file /tmp/kp-body.md
```

## Labels (created by `scripts/gh-setup.sh`)

| Label | Used for |
|---|---|
| `build-fix` | everything in this effort |
| `work-package` | one unit of work done by one agent in one worktree |
| `needs-owner` | blocked on a decision or approval from the owner |
| `engine-mismatch` | a calculation disagrees with a reference value (a real bug, not tooling) |
| `agent-report` | audit / verification reports |

Existing labels (`calc-engine`, `decision`, `mvp`, …) are added where they fit.

## Structure

- **Tracking issue** — `Build fix: one engine, green tests` (labels `build-fix`). The single place for the plan,
  checkpoints and owner approvals. Its body holds a task list of every work-package issue, kept up to date.
- **Work-package issues** — one per package (labels `build-fix`, `work-package`). Created by the orchestrator.
- **PRs** — one per work-package, from `build/<package>` into `build/integration`, body contains `Closes #<package issue>`.
  GitHub only auto-closes issues on merges into `main`, so package issues stay **open** after their PR merges into
  `build/integration`. The orchestrator then comments `Merged into build/integration via #<pr>` on the issue.
  The final PR is `build/integration` → `main`. Its body lists `Closes #<n>` for **every** package issue and every
  `engine-mismatch` issue it fixes, so merging it closes them all. **Only the owner merges that one.**
  Agents never close issues by hand.
- **Decision issues #22–#25** — the owner records decisions there. Agents read them; they never decide them.
  A decision is final when the issue is closed and the owner's last comment states it. Otherwise the code keeps an
  explicit option with `TODO(#NN)`. If an agent hits one of these, it comments on that issue describing where in the
  code the decision applies (once per issue, not per file).

## Work-package issue body

```markdown
<!-- kp-agent:orchestrator -->
**[orchestrator]** Work package: <package-name>

Part of #<tracking issue>. Branch `build/<package-name>`, worktree `../kp-web-wt/<package-name>`.

### Goal
<one paragraph from audit.md>

### Owns (only these files may change)
- `src/...`

### Depends on
- #<issue> (must be merged first) / none

### Tests
- Existing: `test/...`
- New: <what must be pinned, with reference values from audit.md>

### Done when
- [ ] typecheck + tests green in the worktree
- [ ] PR open into `build/integration` with `Closes #<this>`
```

## Status comments (on the package issue)

Agents post at these moments — no others, no running commentary:

1. **Started** — worktree path, branch, base commit.
2. **Blocked** — what, file and line, what is needed, from whom. Add label `needs-owner` if the owner must decide.
3. **Finding** — a real engine disagreement. Also open a separate issue (labels `build-fix`, `engine-mismatch`, `calc-engine`)
   with inputs, expected (and source), actual, and module; link it.
4. **Done** — PR link, test counts before/after, files changed, anything deferred.

## PR body

```markdown
<!-- kp-agent:<agent> -->
**[<agent>]** <title>

Closes #<package issue>. Part of #<tracking issue>.

### What changed
- ...

### Tests
- `npm run typecheck`: pass
- `npm test`: <passed>/<total> (was <n> on base)
- Expected values or tolerances changed: **none** (or list each one with justification and source)

### Not done / follow-ups
- ...
```

## Reviews

The orchestrator reviews every package PR with `gh pr review <n> --comment --body-file ...`
(GitHub does not allow approving your own PR, so reviews are comments). The review states one of:
**LGTM — merging**, or **Changes needed** with a numbered list. Changes go back to the agent via the PR thread;
the agent replies on the PR when fixed.

Merges into `build/integration` go through `scripts/gh-merge-package.sh <pr>` only. It refuses any other base branch.

## Checkpoints (owner approval)

At a checkpoint the orchestrator:
1. posts a comment on the tracking issue with the summary and the exact question(s), labels the issue `needs-owner`;
2. stops, or waits with `scripts/gh-wait-reply.sh <issue>` (polls until a comment without the agent marker appears).

The owner answers **on GitHub** (from any device). The orchestrator then reads all owner comments since its
checkpoint comment (`gh issue view <n> --comments`), removes `needs-owner`, acknowledges in one comment what it
understood and will do, and continues. Owner comments override anything in the plan.
