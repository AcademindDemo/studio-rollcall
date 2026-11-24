#!/bin/bash
# worker.sh <claude|codex|grok> <part>
# Starts one worker headless for one part of the job: a fresh worktree on its own branch,
# the brief .work/briefs/<part>.md as its prompt, the report schema as the shape of its last
# message, and the run's result saved as .work/reports/<part>.json. Its process id goes to
# .work/pids/<part>.pid, where scripts/status.sh finds it. It fails when the worker sends no
# report, whatever the tool's exit code says. Run it from the repository.
# Codex runs in its workspace-write sandbox, with the worktree's git directory and the shared
# objects, refs and logs writable so it can commit, and loopback networking on for tests.
# Grok's sandbox on Linux runs inside bubblewrap: sudo apt install bubblewrap. The script checks
# for it before it makes the worktree.
set -euo pipefail

case ${1:-} in
  claude | codex | grok) ;;
  *)
    echo "worker.sh <claude|codex|grok> <part>" >&2
    exit 2
    ;;
esac
tool=$1
part=${2:?worker.sh <claude|codex|grok> <part>}
repo=$(git rev-parse --show-toplevel)
worktree=$(dirname "$repo")/reports-$part
brief=$repo/.work/briefs/$part.md
schema=$repo/scripts/report.schema.json
report=$repo/.work/reports/$part.json
events=${report%.json}.events.jsonl

if [ ! -f "$brief" ]; then
  echo "no brief at $brief" >&2
  exit 2
fi
if [ "$tool" = grok ] && [ "$(uname -s)" = Linux ] && ! bwrap --ro-bind / / true 2>/dev/null; then
  echo "Grok's sandbox on Linux runs inside bubblewrap: install it (sudo apt install bubblewrap) and check that bwrap --ro-bind / / true runs" >&2
  exit 2
fi
mkdir -p "$(dirname "$report")" "$repo/.work/pids"
echo $$ > "$repo/.work/pids/$part.pid"

git -C "$repo" worktree add "$worktree" -b "report-export/$part"
(cd "$worktree" && npm ci --silent)
cd "$worktree"

case $tool in
  claude)
    claude -p "$(cat "$brief")" --output-format json --json-schema "$(cat "$schema")" \
      --permission-mode dontAsk \
      --allowedTools "Edit Write Bash(git add *) Bash(git commit *) Bash(npm run check)" \
      > "$report" || true
    session=$(jq -r '.session_id // empty' "$report" 2> /dev/null || true)
    result=$(jq '.structured_output // empty' "$report" 2> /dev/null || true)
    ;;
  codex)
    rm -f "$report"
    gitdir=$(git rev-parse --absolute-git-dir)
    common=$(git rev-parse --path-format=absolute --git-common-dir)
    codex exec --json --output-schema "$schema" -o "$report" --sandbox workspace-write --trust \
      -c sandbox_workspace_write.network_access=true \
      -c "sandbox_workspace_write.writable_roots=[\"$gitdir\",\"$common/objects\",\"$common/refs\",\"$common/logs\"]" \
      "$(cat "$brief")" < /dev/null > "$events" || true
    session=$(jq -r 'select(.type == "thread.started") | .thread_id' "$events" 2> /dev/null | head -n 1 || true)
    result=$(cat "$report" 2> /dev/null || true)
    ;;
  grok)
    grok -p "$(cat "$brief")" --output-format json --json-schema "$(cat "$schema")" \
      --always-approve --sandbox workspace --deny "Bash(git push *)" --no-auto-update \
      > "$report" || true
    session=$(jq -r '.sessionId // empty' "$report" 2> /dev/null || true)
    result=$(jq '.structuredOutput // empty' "$report" 2> /dev/null || true)
    ;;
esac

if [ -z "$result" ]; then
  echo "worker $part did not report back: read .work/reports/$part.* for what happened" >&2
  exit 1
fi
echo "worker $part ended, session $session:"
echo "$result"
