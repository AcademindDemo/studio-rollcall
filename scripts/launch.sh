#!/bin/bash
# launch.sh <claude|codex|grok>:<part> [<tool>:<part> ...]
# Starts one worker per part at once through scripts/worker.sh, each logging to
# .work/logs/<part>.log, waits for all of them and prints each part's report status.
# Name only parts that wait for nothing: a part that waits for another starts in a later
# call, once the lead has merged what it waits for. Run it from the repository.
set -euo pipefail

if [ $# -eq 0 ]; then
  echo "launch.sh <claude|codex|grok>:<part> [<tool>:<part> ...]" >&2
  exit 2
fi
repo=$(git rev-parse --show-toplevel)
mkdir -p "$repo/.work/logs"

for job in "$@"; do
  part=${job#*:}
  if [ ! -f "$repo/.work/briefs/$part.md" ]; then
    echo "no brief at .work/briefs/$part.md, nothing started" >&2
    exit 2
  fi
done

parts=()
pids=()
for job in "$@"; do
  tool=${job%%:*}
  part=${job#*:}
  "$repo/scripts/worker.sh" "$tool" "$part" > "$repo/.work/logs/$part.log" 2>&1 &
  parts+=("$part")
  pids+=("$!")
  echo "started $part on $tool, pid $!, log .work/logs/$part.log"
done

failed=0
for i in "${!pids[@]}"; do
  part=${parts[$i]}
  if wait "${pids[$i]}"; then
    status=$(jq -r '(.structured_output // .structuredOutput // .).status' "$repo/.work/reports/$part.json")
    echo "$part: $status, report .work/reports/$part.json"
  else
    echo "$part: worker failed, see .work/logs/$part.log"
    failed=1
  fi
done
exit $failed
