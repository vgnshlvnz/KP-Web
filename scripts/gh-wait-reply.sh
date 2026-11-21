#!/usr/bin/env bash
# Wait for the owner to reply on an issue or PR.
# An owner reply is any comment posted after the newest agent comment that lacks the
# "<!-- kp-agent:" marker. Prints the reply bodies and exits 0; exits 2 on timeout.
#   scripts/gh-wait-reply.sh <issue-or-pr-number> [timeout-minutes, default 9] [poll-seconds, default 60]
# Run it in the background for long waits; re-run after a timeout.
set -euo pipefail
REPO="vgnshlvnz/KP-Web"
N="${1:?usage: $0 <number> [timeout-min] [poll-sec]}"
TIMEOUT_MIN="${2:-9}"
POLL="${3:-60}"
deadline=$(( $(date +%s) + TIMEOUT_MIN * 60 ))

# Issue comments endpoint works for PRs too (conversation comments).
query='[.[] | {created_at, body}]
  | (map(select(.body | contains("<!-- kp-agent:"))) | last | .created_at // "") as $since
  | map(select((.body | contains("<!-- kp-agent:") | not) and .created_at > $since))'

while :; do
  replies="$(gh api --paginate "repos/$REPO/issues/$N/comments?per_page=100" | jq -s 'add' | jq -c "$query")"
  if [[ "$(jq 'length' <<<"$replies")" -gt 0 ]]; then
    jq -r '.[] | "--- owner reply at \(.created_at) ---\n\(.body)\n"' <<<"$replies"
    exit 0
  fi
  [[ $(date +%s) -ge $deadline ]] && { echo "no owner reply on #$N within ${TIMEOUT_MIN} min"; exit 2; }
  sleep "$POLL"
done
