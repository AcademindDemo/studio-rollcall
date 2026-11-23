#!/bin/bash
# resume.sh <claude|codex|grok> <part> "<what is new>"
# Sends a worker that scripts/worker.sh started only what is new: the failing check output or
# the answer to its question. It continues the same session, found by the ID in the worker's
# report, in the part's own worktree and with the permissions worker.sh gave it, and saves the
# worker's next report as .work/reports/<part>.json. It fails when the worker sends no report,
# whatever the tool's exit code says. Use the tool the worker ran in.
# Run it from the repository.
set -euo pipefail

usage='resume.sh <claude|codex|grok> <part> "<what is new>"'
case ${1:-} in
  claude | codex | grok) ;;
  *)
    echo "$usage" >&2
    exit 2
    ;;
esac
tool=$1
part=${2:?$usage}
message=${3:?$usage}
repo=$(git rev-parse --show-toplevel)
schema=$repo/scripts/report.schema.json
report=$repo/.work/reports/$part.json
events=${report%.json}.events.jsonl

case $tool in
  claude) session=$(jq -r '.session_id // empty' "$report") ;;
  codex) session=$(jq -r 'select(.type == "thread.started") | .thread_id' "$events" | head -n 1) ;;
  grok) session=$(jq -r '.sessionId // empty' "$report") ;;
esac
if [ -z "$session" ]; then
  echo "no session ID for $part in .work/reports: start a replacement worker instead" >&2
  exit 2
fi

worktree=$(git -C "$repo" worktree list --porcelain | awk -v suffix="/$part" '
  /^worktree / { path = substr($0, 10) }
  /^branch / && substr($0, length($0) - length(suffix) + 1) == suffix { print path; exit }')
if [ -z "$worktree" ]; then
  echo "no worktree on a branch ending in /$part" >&2
  exit 2
fi
cd "$worktree"

case $tool in
  claude)
    claude -p "$message" --resume "$session" --output-format json --json-schema "$(cat "$schema")" \
      --permission-mode dontAsk \
      --allowedTools "Edit Write Bash(git add *) Bash(git commit *) Bash(npm run check)" \
      > "$report"
    result=$(jq '.structured_output // empty' "$report")
    ;;
  codex)
    rm -f "$report"
    codex exec --json --output-schema "$schema" -o "$report" --sandbox workspace-write --trust \
      resume "$session" "$message" < /dev/null >> "$events"
    result=$(cat "$report" 2> /dev/null || true)
    ;;
  grok)
    grok -p "$message" --resume "$session" --output-format json --json-schema "$(cat "$schema")" \
      --always-approve --sandbox workspace --deny "Bash(git push *)" --no-auto-update \
      > "$report"
    result=$(jq '.structuredOutput // empty' "$report")
    ;;
esac

if [ -z "$result" ]; then
  echo "worker $part did not report back: read .work/reports/$part.* for what happened" >&2
  exit 1
fi
echo "worker $part resumed, session $session:"
echo "$result"
