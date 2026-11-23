#!/bin/bash
# review.sh <claude|codex|grok> <part> [<commit before the fix>]
# Starts a fresh, read-only reviewer session for one part of the job, in the worktree that
# scripts/worker.sh made for it. The reviewer follows the review-change skill
# (.agents/skills/review-change) against the part's brief, reads the part's branch against main
# and writes its findings report to .work/reviews/<part>.md. Pick another tool than the
# worker's. Given the commit before a fix, it is the follow-up review: it reads only that fix
# and adds its findings to the report under "## Follow-up".
# The reviewer may run one command, CHECK (default: npm run check). Run it from the repository.
set -euo pipefail

usage="review.sh <claude|codex|grok> <part> [<commit before the fix>]"
case ${1:-} in
  claude | codex | grok) ;;
  *)
    echo "$usage" >&2
    exit 2
    ;;
esac
tool=$1
part=${2:?$usage}
fix_base=${3:-}
base=main
check=${CHECK:-npm run check}
skill=.agents/skills/review-change/SKILL.md
repo=$(git rev-parse --show-toplevel)
brief=$repo/.work/briefs/$part.md
review=$repo/.work/reviews/$part.md

worktree=$(git -C "$repo" worktree list --porcelain | awk -v suffix="/$part" '
  /^worktree / { path = substr($0, 10) }
  /^branch / && substr($0, length($0) - length(suffix) + 1) == suffix { print path; exit }')
if [ -z "$worktree" ]; then
  echo "no worktree on a branch ending in /$part" >&2
  exit 2
fi
if [ ! -f "$brief" ]; then
  echo "no brief at $brief" >&2
  exit 2
fi

if [ -z "$fix_base" ]; then
  prompt="Use the review-change skill ($skill) as the reviewer. Review this branch against $base: git diff $base...HEAD. Change no file. Your last message is the findings report, filled in up to ## Found.

The goal the change was built for:

$(cat "$brief")"
else
  if [ ! -f "$review" ]; then
    echo "no first review at $review" >&2
    exit 2
  fi
  prompt="Use the review-change skill ($skill) as the reviewer, for the follow-up review. Read only the fix, git diff $fix_base..HEAD, and the findings below. Change no file. Your last message is a ## Found section with the findings that still hold and any the fix brought in.

The first review and how it was settled:

$(cat "$review")"
fi

reviewer() {
  case $tool in
    claude)
      claude -p "$prompt" --permission-mode dontAsk \
        --disallowedTools "Edit Write NotebookEdit" --allowedTools "Bash($check)"
      ;;
    codex)
      codex exec --sandbox read-only --trust "$prompt" < /dev/null
      ;;
    grok)
      grok -p "$prompt" --output-format plain --always-approve --sandbox read-only \
        --deny Edit --no-auto-update
      ;;
  esac
}

cd "$worktree"
findings=$(reviewer)
if [ -z "$findings" ]; then
  echo "the $tool reviewer sent no findings report" >&2
  exit 1
fi
mkdir -p "$(dirname "$review")"
if [ -z "$fix_base" ]; then
  printf '%s\n' "$findings" > "$review"
else
  printf '\n## Follow-up\n\n%s\n' "$findings" >> "$review"
fi
echo "review of $part by $tool in .work/reviews/$part.md:"
cat "$review"
