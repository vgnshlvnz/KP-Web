#!/usr/bin/env bash
# Manage git worktrees for parallel KP-Web work.
#
# Worktrees live in ../kp-web-wt/<name>, each on branch build/<name>, based on the
# latest origin/build/integration (run scripts/gh-setup.sh once first).
# Merging happens on GitHub via PRs (scripts/gh-merge-package.sh), not locally.
#
#   scripts/worktrees.sh new <name>     fetch, create worktree + branch from origin/build/integration
#   scripts/worktrees.sh path <name>    print the absolute path of a worktree
#   scripts/worktrees.sh push <name>    push build/<name> to origin (sets upstream)
#   scripts/worktrees.sh update <name>  merge the latest origin/build/integration into build/<name> (no force-push needed)
#   scripts/worktrees.sh list           list worktrees
#   scripts/worktrees.sh rm <name>      remove worktree (keeps the branch)
#   scripts/worktrees.sh clean          remove all worktrees under ../kp-web-wt and prune
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
WT_DIR="$(cd "$ROOT/.." && pwd)/kp-web-wt"
BASE="origin/build/integration"

need_base() {
  git -C "$ROOT" fetch -q origin
  git -C "$ROOT" rev-parse --verify -q "$BASE" >/dev/null \
    || { echo "$BASE not found — run scripts/gh-setup.sh first"; exit 1; }
}

cmd="${1:-}"; name="${2:-}"
case "$cmd" in
  new)
    [[ -n "$name" ]] || { echo "usage: $0 new <name>"; exit 1; }
    need_base
    mkdir -p "$WT_DIR"
    path="$WT_DIR/$name"
    if [[ -d "$path" ]]; then echo "$path"; exit 0; fi
    if git -C "$ROOT" show-ref --verify --quiet "refs/heads/build/$name"; then
      git -C "$ROOT" worktree add -q "$path" "build/$name"
    else
      git -C "$ROOT" worktree add -q -b "build/$name" "$path" "$BASE"
    fi
    echo "$path"
    ;;
  path)
    echo "$WT_DIR/$name"
    ;;
  push)
    [[ -n "$name" ]] || { echo "usage: $0 push <name>"; exit 1; }
    git -C "$WT_DIR/$name" push -u origin "build/$name"
    ;;
  update)
    [[ -n "$name" ]] || { echo "usage: $0 update <name>"; exit 1; }
    need_base
    git -C "$WT_DIR/$name" merge --no-edit "$BASE"
    ;;
  list)
    git -C "$ROOT" worktree list
    ;;
  rm)
    [[ -n "$name" ]] || { echo "usage: $0 rm <name>"; exit 1; }
    git -C "$ROOT" worktree remove "$WT_DIR/$name"
    ;;
  clean)
    for d in "$WT_DIR"/*/; do
      [[ -d "$d" ]] && git -C "$ROOT" worktree remove --force "$d"
    done
    git -C "$ROOT" worktree prune
    ;;
  *)
    sed -n '2,16p' "$0"; exit 1
    ;;
esac
