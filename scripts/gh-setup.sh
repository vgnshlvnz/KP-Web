#!/usr/bin/env bash
# One-time GitHub setup for the build-fix effort: checks gh auth, creates labels,
# and publishes the build/integration branch so PRs can target it.
set -euo pipefail
REPO="vgnshlvnz/KP-Web"

gh auth status >/dev/null 2>&1 || { echo "gh is not logged in — run: gh auth login"; exit 1; }

gh label create build-fix       --repo "$REPO" --color 0052cc --description "Build fix: one engine, green tests" --force
gh label create work-package    --repo "$REPO" --color 5319e7 --description "One unit of agent work in one worktree" --force
gh label create needs-owner     --repo "$REPO" --color d93f0b --description "Blocked on a decision or approval from the owner" --force
gh label create engine-mismatch --repo "$REPO" --color b60205 --description "Calculation disagrees with a reference value" --force
gh label create agent-report    --repo "$REPO" --color c5def5 --description "Audit or verification report" --force

ROOT="$(git rev-parse --show-toplevel)"
git -C "$ROOT" fetch origin
if ! git -C "$ROOT" ls-remote --exit-code --heads origin build/integration >/dev/null; then
  git -C "$ROOT" push origin origin/main:refs/heads/build/integration
  echo "published build/integration from origin/main"
fi
echo "GitHub setup done."
