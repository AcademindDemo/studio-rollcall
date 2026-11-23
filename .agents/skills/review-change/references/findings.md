# Findings report

The reviewer writes the header and `## Found`. Whoever settles the findings adds the rest after
the last round. The report lives in `.work/reviews/<part>.md` or in the task file; a change with
neither puts a `Settled findings:` line into the commit message that lands it.

```markdown
## Review

Reviewer: <tool and model>, fresh session, read-only, <base>...<head>
Rounds: 1 full[, 1 follow-up of <fix commit>]

## Found

- <high|medium>: <file:line>: <what fails, how to see it fail>

## Settled

- <finding>: <fixed|dropped>: <evidence or reason>

## Open for the owner

- <finding>: <why it stayed open>
```

- One line per finding in every section.
- An empty `## Found` says the reviewer found nothing, which is different from no review.
- Evidence for `fixed` names the test that failed without the fix, or the check command and its
  result on the fix commit.
- A follow-up reads only the fix and the disputed findings, adds its own `## Found` under
  `## Follow-up`, and never starts another full review.
