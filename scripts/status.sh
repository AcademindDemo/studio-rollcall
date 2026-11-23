#!/bin/bash
# status.sh
# Lists every worker scripts/worker.sh started, from its process id in .work/pids, and says
# whether it is running, waiting on a question, done or crashed: a worker whose process is gone
# without a report crashed. Run it from the repository, as often as you like.
set -euo pipefail

repo=$(git rev-parse --show-toplevel)
shopt -s nullglob
pidfiles=("$repo"/.work/pids/*.pid)
if [ ${#pidfiles[@]} -eq 0 ]; then
  echo "no workers started yet"
  exit 0
fi

for pidfile in "${pidfiles[@]}"; do
  part=$(basename "$pidfile" .pid)
  pid=$(cat "$pidfile")
  report=.work/reports/$part.json
  log=.work/logs/$part.log
  if ps -o args= -p "$pid" 2>/dev/null | grep -q worker.sh; then
    echo "$part: running, pid $pid$([ -f "$repo/$log" ] && echo ", log $log")"
    continue
  fi
  result=$(jq -c '.structured_output // .structuredOutput // .' "$repo/$report" 2>/dev/null || true)
  case $(jq -r '.status // empty' <<<"$result" 2>/dev/null) in
    done)
      echo "$part: done, checks $(jq -r .checks <<<"$result"), report $report"
      ;;
    blocked)
      echo "$part: waiting on a question, report $report"
      jq -r '.openQuestions[] | "  - " + .' <<<"$result"
      ;;
    *)
      echo "$part: crashed, process $pid gone without a report$([ -f "$repo/$log" ] && echo ", see $log")"
      ;;
  esac
done
