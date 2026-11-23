---
name: orchestrate
description: >-
  Lead a larger job: split the goal into independent parts, start one worker
  session per part with the repository's scripts, check and review what each
  part delivers, and come back with one outcome and the open decisions. Use
  when told to orchestrate or lead a job, or to coordinate workers. Not for a
  change that stays in one session, not for building a part yourself, and not
  for reviewing a finished diff (use review-change).
---

# Orchestrate a job

You lead. You write no application code yourself: every part goes to a worker, a session of its
own started by a script, in a worktree and branch of its own, in whichever tool fits the part.

1. **Task file.** Write `tasks/<job>.md`: the goal and its outcome, every part with the files it
   owns, its worker's tool and branch, what it waits for and its status (waiting, running, done,
   blocked), the shared contract and the owner's open decisions. Update it after every report.
   Everything that must last goes into this file, never only into your session: a fresh lead
   must be able to go on from the file alone.
2. **Briefs.** Write `.work/briefs/<part>.md` for each part. A worker knows only its brief and the
   repository: the goal and why, the constraints and what is out of scope, the files it owns and
   which belong to other parts, the shared contract word for word, the checks it runs, who lands
   the change, what it decides itself and where it stops and reports blocked, and the report it
   ends with. Show the owner the briefs before the workers start.
3. **Start.** Start as many parts that wait for nothing at once as make sense for the work,
   unless the owner set a number: `scripts/launch.sh <tool>:<part> ...`, or
   `scripts/worker.sh <tool> <part>` for one.
   Run it in the background and stay free for the owner. A part that waits starts only once the
   part it needs has landed. Choose the tool, the model and the effort per part where it starts,
   never in the brief: [references/budget.md](references/budget.md).
4. **Reports.** A report in `.work/reports/<part>.json` is a claim. For a `done`, run the checks
   yourself on the worker's branch with `main` merged in. If `main` doesn't merge cleanly, never
   resolve the conflict yourself: the worker merges `main` into its branch (step 6). For a
   `blocked`, answer the question if it is yours to answer; a decision about the product goes
   to the owner while the other parts keep running.
5. **Review.** Before a part lands, have it reviewed:
   `scripts/review.sh <tool> <part>` starts a fresh, read-only session in another tool than the
   worker's, which reviews the branch with the review-change skill into
   `.work/reviews/<part>.md`. Settle the findings with that skill. A fix goes back to the same
   worker, and its follow-up review reads only the fix:
   `scripts/review.sh <tool> <part> <commit before the fix>`.
6. **Resume, don't restart.** A part that needs a fix or an answer goes back to the worker that
   built it, told only what is new: `scripts/resume.sh <tool> <part> "<failing output, conflict or answer>"`.
   Start a replacement worker only when the session went the wrong way, lost its decisions or
   cannot be found: the brief, the branch as it stands and two lines on what was tried.
7. **Land.** Merge the part into `main`, run the checks on `main`, set the part to done and
   start what waited for it. Then remove the worktree and branch you created for that part,
   never one with uncommitted work or one you did not create.
8. **Workers never talk to each other.** A gap in the shared contract goes to the worker that
   owns the contract, never to the one that tripped over it.
9. **Finish** with the checks green on `main` and one outcome for the owner: what landed, the
   result of the checks and the decisions still open.
