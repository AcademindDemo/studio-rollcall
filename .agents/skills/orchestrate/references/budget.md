# How many workers, which tool and model

Read this when step 3 of the orchestrate skill needs a choice.

## How many at once

- Parts that touch different files, with any shared contract already landed, can run at the same
  time. Tightly connected code stays in one worker.
- How many run at once is your call: as many independent parts as make sense for the work. The
  owner can always set a number, and that wins.
- Every worker on the same account draws on the same usage as the lead. On a small plan a few
  workers at once can use it up quickly: three app workers used up a Claude Pro window in about
  half an hour.
- `scripts/launch.sh` starts every part you name at once, so name only the ones you mean to run
  together. `scripts/status.sh` says which workers still run.

## Which tool, model and effort

Set them where the worker starts, never in the brief, so the same brief runs in any tool.

| Kind of part | Model | Effort |
| --- | --- | --- |
| Looking something up, a mechanical edit from a clear brief | a smaller, faster model | low or medium |
| Building a part, settling a contract | the strongest model you have | high |
| Reviewing a part | another tool than the worker's, else a fresh session of the strongest model | high |

The owner's choice wins: "only Claude Code", a named model, a tool for one part.

The highest effort is no safe default: it takes longer, uses more and can overthink. Raise it for
a part that failed in a way that should have been easy.
