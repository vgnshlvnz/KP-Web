# KP-Web build-fix kit — setup

Everything is coordinated on GitHub: a tracking issue, one issue per work package, one PR per package into
`build/integration`, reviews as PR comments, and checkpoints you answer on the tracking issue (phone works).

## Files

```
CLAUDE.md                          project instructions Claude Code reads every session
docs/build-fix/GITHUB-PROTOCOL.md  how agents use issues, comments, PRs, labels, checkpoints
docs/build-fix/PROMPTS.md          the three phase prompts to paste
.claude/settings.json              allows test/git/gh/worktree commands; blocks deploy, push to main,
                                   direct `gh pr merge`, closing/deleting issues, Swiss Ephemeris npm packages
.claude/agents/engine-auditor.md   compares both engines with Swiss Ephemeris, PRs audit.md (Opus)
.claude/agents/build-fixer.md      adds astronomy-engine, migrates 5 test files to vitest (Sonnet)
.claude/agents/module-porter.md    does one work package in its own worktree (Sonnet)
.claude/agents/verifier.md         fresh-eyes final check, posts report on the final PR (Opus)
scripts/gh-setup.sh                labels + publishes build/integration (run once)
scripts/worktrees.sh               new / path / push / update / list / rm / clean
scripts/gh-merge-package.sh        merges a PR only if its base is build/integration
scripts/gh-wait-reply.sh           waits for your (non-agent) comment on an issue or PR
.github/workflows/ci.yml           typecheck + tests on push and PR
```

## Prerequisites
- `gh` logged in with write access to vgnshlvnz/KP-Web: `gh auth login`, then `gh auth status`
- `jq` (`sudo apt install jq`), Node 22, Python 3 (the auditor uses a temp venv)

## Install

```bash
cd ~/path/to/KP-Web
git switch main && git pull
unzip -o ~/Downloads/kp-web-claude-kit.zip -d .
chmod +x scripts/*.sh
git add CLAUDE.md .claude scripts .github docs/build-fix SETUP.md
git commit -m "chore: add Claude Code build-fix kit"
git push origin main          # must be on GitHub before gh-setup.sh branches build/integration from it
claude
```

Then paste Phase 1 from `docs/build-fix/PROMPTS.md`.

## Notes
- Agents post from your account. Their comments start with a hidden `<!-- kp-agent:name -->` marker and a **[name]** tag. Any comment without the marker counts as you, and the agents treat it as an instruction.
- Package issues stay open until the final PR merges into `main`, which closes them all. That's how GitHub's `Closes #n` works.
- Only you merge into `main`. The agents can merge into `build/integration`, and only through the guard script.
- Worktrees go in `../kp-web-wt/`. Each one runs its own `npm ci`.
- The auditor installs `pyswisseph` in `/tmp/kp-audit-venv` only to get reference values. It never enters the project.
- To run on your DGX Spark/LiteLLM stack, change or remove the `model:` lines in `.claude/agents/*.md`.
