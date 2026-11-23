---
name: review-change
description: >-
  Review a finished change as an independent reviewer who tries to break it,
  or settle the findings such a review returned. Use when asked to review a
  branch, a diff or a part of a larger job, or when a review's findings come
  back to the session that wrote the change or leads the job. Not for writing
  the change, and not a replacement for the repository's checks.
---

# Review a change

The reviewer is a fresh session that never saw the conversation which wrote the change, best in
another tool than the author's, because another model has other blind spots. It is started so
that it cannot edit files: Codex with `--sandbox read-only`, Claude Code with edits denied,
Grok with `--sandbox read-only`. `scripts/review.sh` starts one for a part of a larger job.

## As the reviewer

You did not write this change, and you change no file.

1. Read the goal you are given and the diff (`git diff <base>...HEAD`). Read the code around the
   changed lines too, not only the lines.
2. Try to break it: the goal's edge cases, wrong or missing input, a dependency that fails, two
   users at once, data that already exists. Where running proves more than reading, run the
   tests or the app.
3. Report only real findings, each with `file:line`, what fails, how to see it fail and how bad
   it is: `high` when users, money, data or security are hit in normal use, `medium` for a real
   but bounded case. Leave out taste and what the checks already enforce; five small findings
   at most.
4. Answer with the findings report from [references/findings.md](references/findings.md), filled
   in up to `## Found`. Nothing found is an allowed result: say so.

## As the author or the lead settling it

5. Check each finding against the code. Settle it as `fixed` with evidence: a test or a
   reproduced wrong result that fails before the fix and passes after it. Or settle it as
   `dropped` with its reason: it does not hold, it is intentional, or it doesn't matter next to
   this change. An unclear finding gets one bounded check, a question with a yes or a no.
6. Never drop a finding that touches data, money or security, and never change behaviour the
   owner decided: both go to the owner.
7. One full review per change, then at most one follow-up review that reads only the fix and
   the disputed findings. What is still open after that goes to the owner.
8. Fill in `## Settled` and `## Open for the owner` and keep the report in the repository.
