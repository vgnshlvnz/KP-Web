# Build-fix prompts for Claude Code

Paste these into Claude Code from the main KP-Web checkout, one phase at a time.
The main session acts as the **orchestrator**: it creates issues, starts subagents in worktrees, reviews and merges PRs into
`build/integration`. All communication happens on GitHub (`docs/build-fix/GITHUB-PROTOCOL.md`), so you can follow and answer
from github.com or the GitHub app on your phone.

Checkpoints are GitHub comments labelled `needs-owner` on the tracking issue. Reply there; the orchestrator picks it up.

---

## Phase 1 — tracking issue, fix the plumbing, audit the engines

```
You are the orchestrator for the KP-Web build fix. Read CLAUDE.md and
docs/build-fix/GITHUB-PROTOCOL.md first and follow the protocol exactly: every
plan, status, review and question goes on GitHub with the kp-agent:orchestrator
marker; your terminal replies are only short pointers to what you posted.

1. Run scripts/gh-setup.sh.

2. Create the tracking issue "Build fix: one engine, green tests" (label build-fix).
   Body: the current state and target state from CLAUDE.md, the three phases, and
   a task list that will hold the work-package issues. Link #22–#25 as the owner's
   decision issues.

3. Create two work-package issues using the protocol template, and add them to the
   tracking issue's task list:
   - "Work package: fix-build" — owned files and tasks from .claude/agents/build-fixer.md
   - "Work package: audit" — scope from .claude/agents/engine-auditor.md

4. Create worktrees: scripts/worktrees.sh new fix-build, scripts/worktrees.sh new audit.

5. Start both subagents in parallel, in the background:
   - build-fixer: its issue number, the tracking issue number, its absolute worktree path.
   - engine-auditor: same.
   Don't edit anything yourself while they run.

6. When each opens its PR, review it on GitHub (gh pr diff, then gh pr review
   --comment with "LGTM — merging" or "Changes needed" + numbered list). For the
   fix-build PR check especially that no expected value or tolerance in test/ changed.
   If changes are needed, wait for the agent's reply on the PR and review again.
   Merge with scripts/gh-merge-package.sh <pr>, then comment
   "Merged into build/integration via #<pr>" on the package issue, and tick it in the
   tracking issue's task list.

7. After both are merged, on a fresh scripts/worktrees.sh new check-1 run
   npm ci && npm run typecheck && npm test and record the counts.

8. CHECKPOINT: comment on the tracking issue with
   - typecheck/test results on build/integration,
   - links to any engine-mismatch issues,
   - a link to docs/build-fix/audit.md and the auditor's tracking-issue comment,
   - the proposed porting order and the open questions, as numbered questions
     I can answer by number.
   Add the needs-owner label. Then run scripts/gh-wait-reply.sh <tracking issue>
   in the background and tell me in one line that you're waiting on GitHub.
   Do not start porting until I approve there.
```

**Your checkpoint (on GitHub):** read `audit.md` (accuracy table and sub-lord mismatches), then reply on the tracking issue: approve the porting order or change it, and answer the numbered questions. Your decisions on #22–#24 can go on those issues whenever you're ready. Until then the code keeps them as explicit options.

If the wait times out before you reply, type `continue` in Claude Code after you've replied on GitHub.

---

## Phase 2 — consolidate into one engine (one worktree + issue + PR per package)

```
Continue as orchestrator. Read every comment on the tracking issue since your
checkpoint. My replies there are the instructions: apply any changes to the
porting order, remove the needs-owner label, and post one comment summarising
what you understood and the final package list.

Then:
1. Create one work-package issue per package (protocol template: goal, owned
   files, dependencies as issue links, tests, done-when). Add them all to the
   tracking issue's task list.

2. Foundation first, alone: the unified-types package. scripts/worktrees.sh new
   <name>, start a module-porter with its issue number, the tracking issue number
   and absolute worktree path. Review its PR on GitHub, merge with
   scripts/gh-merge-package.sh, comment on the package issue, tick the task list.

3. Then, in parallel (max 4 at a time): every package whose dependency issues are
   merged and whose owned files don't overlap another running package. Create its
   worktree from the current origin/build/integration and start a module-porter
   in the background.

4. For each PR as it arrives: review on GitHub — only owned files touched, no
   loosened expected values or tolerances, no decisions taken for #22/#23/#24,
   tests and typecheck pass. Merge one at a time with gh-merge-package.sh. After
   each merge, tell any still-open package PR that now conflicts (comment on the
   PR) to run scripts/worktrees.sh update and re-push.

5. If an agent posts Blocked with needs-owner, or opens an engine-mismatch issue
   that changes the plan, post a checkpoint on the tracking issue, wait with
   gh-wait-reply.sh, and act on my reply. Keep other independent packages going.

6. The last package is the entrypoint: src/index.ts (Hono) as the only entrypoint,
   covering everything src/worker.ts exposed, and removal of modules nobody
   imports (only where audit.md says their behaviour is ported and tested).
   Wiring src/core/* into routes is issue #12, not this job.

7. Remove finished worktrees with scripts/worktrees.sh rm <name>.

8. CHECKPOINT on the tracking issue: what merged (PR links), final test count vs
   start, anything sent back, open engine-mismatch issues. Label needs-owner and
   wait.
```

**Your checkpoint (on GitHub):** look over the tracking issue's task list and the merged PRs. Reply "go to phase 3", or give instructions.

---

## Phase 3 — final PR and independent verification

```
Continue as orchestrator. Read my latest replies on the tracking issue first.

1. Open the final PR build/integration → main, titled "Build fix: one engine,
   green tests". Body: summary, links to every package PR, test counts before and
   after, and a "Closes #n" line for the tracking issue, every work-package issue,
   and every engine-mismatch issue that's fixed.
2. scripts/worktrees.sh new verify, then start the verifier subagent with the
   final PR number, the tracking issue number and the absolute path. Tell it only
   to follow its own instructions — don't summarise the work for it.
3. When it posts its report on the final PR, comment on the tracking issue:
   if "Not ready", list each FAIL with the package it belongs to and a proposed
   fix, label needs-owner, and wait. Don't fix anything until I reply.
   If "Ready", label needs-owner and tell me it's ready for me to merge.
4. Never merge the final PR yourself.
```

**Your checkpoint:** read the verifier's comment on the final PR. If it's ready, merge it on GitHub yourself. CI runs typecheck and tests first. Merging closes every package issue. Then run `scripts/worktrees.sh clean`.

---

## After the build is green

Close #25 (settled in `docs/licensing.md`) and record your decisions on #22, #23 and #24. Then follow the issue order: #4, then #12, then #15. Each issue works the same way: one worktree and one branch per issue, an agent posts on the issue and opens a PR, the orchestrator reviews on the PR, and the verifier signs off.
