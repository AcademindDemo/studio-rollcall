---
name: report
description: Write the end-of-task report for Studio Rollcall. Use at the end of every task, after scripts/gate.sh has run, before saying you are done.
---

# End-of-task report

Run `scripts/gate.sh` first, and run it again if you changed anything after the last run. Then reply with this report and nothing after it. Keep it under 30 lines. Plain facts, no selling.

```
## Report: <task in a few words>

Gate: green | red (<failing step and the first error line>)

Changed
- <file or area>: <what and why, one line each>

Verified
- <what you ran or exercised beyond the gate, e.g. the curl call against PORT=...>

Not done / deviations
- <anything asked for that you did not do, or did differently, and why>
- <any guardrail that got in your way: what it blocked and what you did instead>

Decisions for a human
- <open questions from VISION.md you ran into, or assumptions you made>

Next
- <the smallest useful next step>
```

Rules:
- Never report green unless the last gate run in this task was green. Paste the failing step if it was not.
- Write "none" under a heading instead of dropping it.
- If you touched `tsconfig.json`, `eslint.config.js`, `scripts/gate.sh` or the dependencies, say so under "Changed" with the reason.
