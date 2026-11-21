#!/usr/bin/env bash
# Merge a work-package PR into build/integration — and nothing else.
# Refuses PRs whose base is not build/integration (so main is never merged by an agent).
#   scripts/gh-merge-package.sh <pr-number>
set -euo pipefail
REPO="vgnshlvnz/KP-Web"
PR="${1:?usage: $0 <pr-number>}"

base="$(gh pr view "$PR" --repo "$REPO" --json baseRefName -q .baseRefName)"
head="$(gh pr view "$PR" --repo "$REPO" --json headRefName -q .headRefName)"
state="$(gh pr view "$PR" --repo "$REPO" --json state -q .state)"

[[ "$base" == "build/integration" ]] || { echo "refusing: PR #$PR targets '$base', not build/integration"; exit 1; }
[[ "$head" == build/* ]]            || { echo "refusing: head '$head' is not a build/* branch"; exit 1; }
[[ "$state" == "OPEN" ]]            || { echo "refusing: PR #$PR is $state"; exit 1; }

gh pr merge "$PR" --repo "$REPO" --merge --delete-branch=false
git fetch origin build/integration
echo "merged #$PR ($head) into build/integration"
