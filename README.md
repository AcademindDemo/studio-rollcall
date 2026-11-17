# Studio Rollcall

The closing project of Academind's course *Working with Coding Agents*: a booking and membership app for small fitness and dance studios, built from an empty repository to a tagged release by coding agents, with the learner only talking to a lead agent. It is fictional and never deployed. TypeScript with Effect, on Node 24.

Members see the week's classes, book a spot with class credits or a monthly membership and join a waitlist that promotes them when someone cancels. Staff see rosters and check members in. Emails confirm bookings and promotions.

## Checkpoints

One tag per lecture. Each lecture of the course's closing section starts at the tag the one before it left:

| Tag | What the repository holds | Lecture |
|---|---|---|
| `start` | `VISION.md` alone | Preparing Studio Rollcall for Agent Work |
| `setup` | the scaffold: `AGENTS.md`, `CLAUDE.md`, the `report` skill, `scripts/gate.sh`, the Effect app and its first HTTP test | Planning the Booking Feature |
| `decided` | the two open questions researched and decided (`decisions/`), the build plan of six parts (`plan.md`) | Building with an Orchestrator |
| `built` | all six parts landed on `main` by six workers | Checking the Combined Build |
| `reviewed` | the audit's fixes: the two-hour cutoff checked inside `allocate`, the final integration flow | Auditing and Shipping |
| `shipped` | the release, the same tree as `reviewed` | Scoping the Next Request |

To follow a lecture from its start, check the tag out:

```sh
git clone https://github.com/AcademindDemo/studio-rollcall.git
cd studio-rollcall
git checkout start
```

## Run

- `npm ci` once, on Node 24 (`.nvmrc`). TypeScript runs directly with `node`, there is no build step.
- `PORT=4101 npm start` runs the app with seeded demo data: one studio, a week of classes starting tomorrow, four members. State is in memory and per process.
- `scripts/gate.sh` is the definition of done: suppression scan, `tsc`, Effect diagnostics, ESLint, Vitest and a smoke run on a free port.

Before `setup` there is nothing to run.

## How it was built

Every file after `VISION.md` was written by an agent. The learner wrote the vision, typed one task per lecture to a lead agent and answered its questions.

- **Setup**: one delegated task asked for the scaffold and its guardrails; done meant `scripts/gate.sh` green.
- **Plan**: two command-line agents researched the open questions in `VISION.md`; the lead joined their answers (`research/`) and wrote `decisions/0001` and `0002`, then `plan.md`, which Codex reviewed once.
- **Build**: one orchestrator session built nothing itself. It briefed one worker per part, each headless in its own worktree on its own branch with its own port: parts 0 and 5 on Claude Code (`claude -p`), parts 1 and 3 on Codex (`codex exec`), parts 2 and 4 on Grok. Each worker ran the gate, had its change reviewed once by a different model, rebased and landed with a fast-forward merge, and ended with the `report` skill.
- **Audit**: the combined build was checked against `VISION.md` and `plan.md`; the findings became the commits between `built` and `reviewed`.

This history is a clean recreation of that run, one commit per checkpoint, so the diff between two tags is what the lecture between them did.
