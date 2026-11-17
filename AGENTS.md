# Studio Rollcall: agent guide

Read `VISION.md` first. Build only what it asks for; the "Not now" list is out of scope, and the "Open questions" are for a human to answer, so ask instead of picking one.

## Run

- `npm ci` once, Node 24 (`.nvmrc`). TypeScript runs directly with `node`, there is no build step.
- `PORT=<free port> npm start` runs the app with seeded demo data: one studio, a week of classes starting tomorrow (UTC), four members. `PORT` is required. Use your own port, never one another agent may be using; state is in memory and per process.
- `scripts/gate.sh` is the definition of done: suppression scan, `tsc`, Effect diagnostics, ESLint, Vitest, and a smoke run of the app on a free port.

## Layout

- `src/domain`: Schemas, branded ids, `Schema.TaggedError` errors. No I/O.
- `src/api`: the `HttpApi` contract shared with clients. No server or Node imports (lint enforces it).
- `src/server`: services (`Context.Service` + `Layer`), handlers, seed data. `src/main.ts` is the only entrypoint.
- `test`: Vitest with `@effect/vitest`. `test/booking.e2e.test.ts` shows how to boot the real server and call it with the typed client.

## Rules

- Every expected failure is a `Schema.TaggedError` in the Effect error channel and in the endpoint's `error` list. No `throw`, no `try`/`catch`, no `any`, no casts.
- Every input crossing a boundary (HTTP, env, files) is decoded with `effect/Schema`. Env vars go through `Config`.
- Time, randomness and timers come from Effect (`DateTime.now`, `Clock`, `Random`), never `Date.now()` or `Math.random()`.
- No `console.*`: use `Effect.log`.
- Never weaken a guardrail to get green: no `@ts-*` or `eslint-disable` comments, no skipped or `.only` tests, no edits to `tsconfig.json`, `eslint.config.js` or `scripts/gate.sh` unless the task is about them. If a rule blocks you, stop and say why in your report.
- New behaviour comes with a test through the HTTP API.
- Effect v4 differs from v3 and from most examples online. Check `node_modules/effect/ai-docs` and the source before guessing an API.

## Finishing a task

Run `scripts/gate.sh` until it is green, then use the `report` skill (`.claude/skills/report/SKILL.md`) to write your end-of-task report.
