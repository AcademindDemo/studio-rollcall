# Studio Rollcall: build plan

Builds everything in [VISION.md](VISION.md) under decisions [0001](decisions/0001-pay-before-booking.md) and [0002](decisions/0002-waitlist-auto-promotion.md), and the answers in [Answered questions](#answered-questions-2026-10-29). The work is one shared-contracts step (part 0) and then five parts. Each part has one owner. Every part follows AGENTS.md, and `scripts/gate.sh` green is part of every done check. Codex reviewed this plan once. Each finding and how it was settled is listed in [Review](#review-codex-2026-10-28) at the end.

## Order

```
0 contracts ──► 1 schedule & booking ──► 2 waitlist ──┐
           │                                         ├──► 5 staff dashboard ──► final integration
           ├──► 3 billing  (may start after 0, lands after 1) ┤
           └──► 4 emails   (may start after 0, lands after 1) ┘
```

- Part 0 lands on `main` before any other part starts.
- Part 2 (waitlist) starts only after part 1 has landed on `main`.
- Parts 3 and 4 build against the part 0 contracts and can be written alongside part 1. They merge after part 1.
- Part 5 starts after parts 1, 2 and 3 have landed.
- The final integration test (owned by the part 0 owner) runs after all five parts have landed.
- Each part merges to `main` with a green gate before the next one in its chain starts.

## Shared rules for every part

- **Wiring.** The wiring files are `src/api/Api.ts`, `src/server/Server.ts`, `src/server/Handlers.ts` and `src/server/Seed.ts`, and part 0 owns them. A later part may add one line each for its own group, layer, handler group or seed slice. It may also replace a line that names a placeholder layer it is assigned to replace (below). It may not change any other line.
- **Placeholder layers.** Part 0 ships these, and the named part replaces them:
  - `Entitlements.layerAllowAll`, replaced by part 3.
  - `Promotion.layerNone`, replaced by part 2.
  - `Outbox.layerDiscard`, replaced by part 4.

  Each replacing part's done check confirms nothing in `src` still references the placeholder.
- **Test seam.** `Server.ts` exports `AppLive`, the whole app with `Entitlements`, `PaymentProvider` and `Promotion` as open requirements. It also exports `ServerLive`, which is `AppLive` with the current real or placeholder layers provided. A test may boot `AppLive` with its own layer for one of those three services, for a scenario the real layers can't yet produce. Every such scenario is repeated against `ServerLive` in the final integration test.
- **Contracts change only through part 0.** Contract files are `src/domain/*` and `src/server/contracts/*`. If a part needs a change there, it stops, says why, and the part 0 owner makes the change in a small separate commit that every part rebases on.
- **Writes are serialised by one studio lock.** `StudioLock` (part 0) is a `Semaphore` with one permit. A small studio's write rate makes one lock cheap, and it removes the races between cancel, promotion, join, purchase and check-in.
  - `StudioLock.withLock((held) => …)` runs the body uninterruptibly. It hands the body a branded `LockHeld` token that only it can create.
  - These commands acquire the lock: `Bookings.book`, `cancel` and `checkIn`, `Waitlist.join` and `leave`, and `Billing.purchase`.
  - These steps run inside a caller's lock: `Entitlements.use` and `restore`, `Bookings.allocate`, `Promotion.onSpotFreed`, and `BookingEvents.publish`. Each takes `LockHeld` as a parameter, so calling one outside the lock is a type error. They never acquire the lock themselves, so the lock is never taken twice.
  - **Order inside a command**: all checks first, then the steps that can fail (`Entitlements.use`), then the in-memory state writes that can't fail, then the event publish. A failure before the writes leaves every ref as it was.
- **Time is UTC and comes from Effect `DateTime.now` / `Clock`.** Rules that depend on the time are checked with `DateTime.now` inside the lock.
- **Tests.**
  - Each part boots the real server the way `test/booking.e2e.test.ts` does, in its own `test/<part>.e2e.test.ts`, and never edits another part's tests.
  - Time-window rules get `TestClock` tests, using `TestClock.adjust`.
  - Background work is tested by calling its step function directly. Tests never poll a background fiber under the virtual clock. A negative assertion is made only after the step has run.
- **No real network calls.** Payments and email are in-process fakes.

## Part 0: shared contracts and scaffold migration (lead)

Schemas, errors, service interfaces, the lock, the event bus, the placeholder layers, and the move of the existing scaffold onto them. No business logic.

**Domain schemas (`src/domain`)**
- `Booking.ts`: `Booking { id, classId, memberId, bookedAt, source: "member" | "waitlist", status: "booked" | "cancelled", cancelledAt?, creditUse: CreditUse, checkedInAt? }`. `CreditUse` is `{ _tag: "PackCredit", packId } | { _tag: "Membership", membershipId }`, a tagged union that records what paid for the booking so a cancel can return it. Inputs are `BookClassInput`, `CancelBookingInput { bookingId, memberId }` and `CheckInInput { bookingId }`.
- `Billing.ts`: `ProductId` = `"pack-5" | "pack-10" | "monthly"`, plus `Product { id, name, priceCents, currency: "EUR", kind }`. `ClassPack { id, memberId, size: 5 | 10, remaining, purchasedAt, expiresAt }`. `Membership { id, memberId, startsAt, endsAt, cardToken, renewal: "active" | "failed" }` (unlimited). `Purchase { id, memberId, productId, amountCents, paymentRef, at, reason: "purchase" | "renewal" }` and `PurchaseInput { memberId, productId, cardToken }`. `MemberBalance { memberId, packCreditsLeft, nextPackExpiry?, membershipEndsAt?, renewal? }`. Expired packs don't count towards `packCreditsLeft`.
- `Waitlist.ts`: `WaitlistEntry { id, classId, memberId, joinedAt, status: "waiting" | "promoted" | "skipped" | "left" }` and `JoinWaitlistInput`.
- `Email.ts`: `EmailKind` = `"BookingConfirmed" | "WaitlistPromoted" | "ClassReminder"`, plus `OutboxEmail { id, kind, to, subject, body, bookingId, createdAt }`.
- `Schedule.ts`: `WeeklyClass { id, title, weekday, startTime, durationMinutes, room, instructor, capacity }` (a weekly template) and an optional `ClassSession.weeklyClassId`. It is optional so the existing constructors still compile.
- `Events.ts`: `BookingEvent` = `BookingConfirmed { booking } | BookingCancelled { booking, creditReturned }`. The source is on the booking itself.
- `Errors.ts` gets these new `Schema.TaggedError`s with HTTP status: `NoCredit` (402), `BookingNotFound` (404), `NotYourBooking` (403), `BookingNotActive` (409, cancelling or checking in a cancelled booking), `ClassStarted` (409), `AlreadyCheckedIn` (409), `AlreadyWaitlisted` (409), `ClassNotFull` (409), `NotOnWaitlist` (404), `PaymentDeclined` (402), `ProductNotFound` (404), `InvalidWeeklyClass` (400), `AlreadyMember` (409).

**Service interfaces (`src/server/contracts`)**: `Context.Service` tags with typed signatures and no implementations.
- `StudioLock`: `withLock`, with the `LockHeld` token. Real layer in part 0.
- `Directory`: `studio`, `getMember(memberId) → Effect<Member, MemberNotFound>`, `listMembers`. Studio and member data. Real seed-backed layer in part 0, moved out of `Store`.
- `Schedule`: `listWeek`, `getClass`, `addWeeklyClass`, `listWeeklyClasses`.
- `Bookings`:
  - Commands that take the lock: `book(input)`, `cancel(input)`, `checkIn(input)`.
  - Steps that run inside the lock: `allocate(held, classId, memberId, source) → Effect<Booking, NoCredit | AlreadyBooked | ClassFull>`. This is what promotion uses.
  - Reads: `roster(classId)`, `forMember(memberId)`, `upcoming(from, to)`.
- `Entitlements`: `use(held, memberId, classSession) → Effect<CreditUse, NoCredit>`, `restore(held, creditUse)`, `balance(memberId)`, `listBalances`. This is the only way booking touches credits.
- `Billing`: `products`, `purchase(input)`, `renewDue` (one renewal pass, also run by the schedule).
- `PaymentProvider`: `charge(cardToken, amountCents) → Effect<PaymentRef, PaymentDeclined>`.
- `Waitlist`: `join(input)` and `leave(input)` (commands), `forClass(classId)` and `forMember(memberId)` (reads).
- `Promotion`: `onSpotFreed(held, classSession) → Effect<ReadonlyArray<Booking>>`. `Bookings.cancel` calls it inside the same lock, right after it frees the spot. That is what makes "the first person waiting gets the spot" atomic, with no gap in which a newcomer can book first.
- `Outbox`: `list(filter?)`, `sweepReminders` (one reminder pass, also run by the schedule).
- `BookingEvents`: an unbounded `PubSub<BookingEvent>`.
  - `publish(held, event)` runs inside the command's lock, so a committed change always has its event.
  - `subscribe` is scoped. A subscriber layer subscribes while the layer is being built, which is before the server serves, so no early event is missed.

**Scaffold migration**: part 0 makes the existing code compile against the new contracts.
- `Store` keeps its booking logic for now, but builds `Booking` with `source: "member"`, `status: "booked"`, and a `creditUse` from `Entitlements.layerAllowAll`. Its studio and member reads move to `Directory`.
- `Seed.ts` is split into `src/server/seed/{directory,schedule}.ts`, with `Seed.ts` composing them.
- `Handlers.ts` and `Server.ts` are rewired as `AppLive` / `ServerLive` with the three placeholder layers.

**Done**
- Gate is green, and `GET /studio` and `GET /classes` still work.
- The existing booking e2e test passes, adapted only for the changed `Booking` shape.
- A test shows `StudioLock.withLock` runs its body uninterruptibly.
- A test shows a layer that subscribes to `BookingEvents` receives an event published right after startup.

## Part 1: schedule and booking

**Owns**: `src/server/schedule/*`, `src/server/booking/*`, `src/api/ScheduleApi.ts`, `src/api/BookingsApi.ts`, `src/server/seed/schedule.ts`, `test/booking.e2e.test.ts`, `test/schedule.e2e.test.ts`. It deletes `src/server/Store.ts` and may replace the wiring lines that name `Store`.

**Builds**
- `Schedule` live layer. Weekly templates expand into sessions for the coming week (UTC). Seed: the current demo week as templates. `GET /classes` lists the week with spots left.
- `Bookings` live layer, with every command under `StudioLock`.
  - **`book`**: check the class exists and hasn't started, check the member via `Directory`, reject a duplicate, check capacity, then `Entitlements.use`. Then write the booking with `source: "member"`, then publish `BookingConfirmed`.
  - **`allocate`**: the same steps for `source: "waitlist"`, run inside the caller's lock.
  - **`cancel`**: the member's own booking, and only `booked → cancelled`. A repeated or concurrent second cancel gets `BookingNotActive` and changes nothing. If it is 12 h or more before start, `Entitlements.restore`. Write the cancellation, publish `BookingCancelled`, then call `Promotion.onSpotFreed` in the same lock.
  - **Walk-in hold**: a spot freed by a cancel 2 h or less before start is held for walk-ins. A spot freed earlier that promotion couldn't fill stays open online. The class keeps a `walkInHolds` count, and online `book` and `allocate` treat held spots as taken (`ClassFull`). `spotsLeft` in `GET /classes` excludes them. Staff handle the walk-in at the desk, outside the app, as decided in 0001.
  - **`checkIn`**: only for a booking that is `booked`. Sets `checkedInAt` once.
- Endpoints: `POST /bookings`, `POST /bookings/{id}/cancel`, `GET /members/{id}/bookings`.

**May not touch**: billing, waitlist, email or staff files, contracts, or other parts' tests.

**Done, via HTTP tests**
- Book, then spots left goes down.
- `AlreadyBooked`; `ClassFull`.
- Booking a started class gives `ClassStarted`.
- Cancel at 12 h or more returns the credit, and cancel inside 12 h does not. Checked through `creditUse` with a counting `Entitlements` on `AppLive`.
- Cancelling someone else's booking gives `NotYourBooking`.
- A second cancel gives `BookingNotActive`, and both credit restores and `BookingCancelled` events are counted once. Two concurrent cancels give the same result.
- Two concurrent check-ins: exactly one succeeds. Check-in after cancel gives `BookingNotActive`.
- Booking, cancel and promotion events are observed by a test subscriber.
- A `TestClock` test for the 12 h boundary at exactly 12:00:00.
- A cancel 2 h or less before class leaves `spotsLeft` unchanged, and another member's online booking of that class gets `ClassFull`.

## Part 2: waitlist (starts after part 1 has landed)

**Owns**: `src/server/waitlist/*`, `src/api/WaitlistApi.ts`, `test/waitlist.e2e.test.ts`. It replaces the `Promotion.layerNone` wiring line.

**Builds**
- `Waitlist` live layer, with commands under `StudioLock`.
  - **`join`** only if the class is full and hasn't started, and the member is neither booked nor already waiting. The member may wait on several classes. No credit is checked or held on join.
  - **`leave`** marks the entry `left`.
- `Promotion` live layer. `onSpotFreed` runs inside `cancel`'s lock.
  - If it is 2 h or less before class start (by `DateTime.now`), it promotes no one, and the spot becomes a walk-in hold (part 1).
  - Otherwise it walks `waiting` entries in `joinedAt` order and calls `Bookings.allocate` for each, until the class is full again. `NoCredit` marks the entry `skipped` and continues. `AlreadyBooked` marks it `promoted` and continues. Success marks it `promoted`.
  - **If everyone waiting is skipped**, the spot is open for online booking again. This only happens more than 2 h before class.
  - Because it runs in the lock, there is no gap for a newcomer, a `leave`, or the 2 h cutoff to slip in.
- Endpoints: `POST /classes/{id}/waitlist`, `DELETE /classes/{id}/waitlist/{memberId}`, `GET /members/{id}/waitlists`.

**May not touch**: booking internals (it uses only the `Bookings` interface), billing, email, staff, contracts.

**Done, via HTTP tests**
- Joining a class that isn't full gives `ClassNotFull`.
- A cancel promotes the first waiter in the same request. The booking has `source: "waitlist"`, and the waiter's entry is `promoted`.
- With an `Entitlements` on `AppLive` that refuses one member, that waiter is `skipped` and the next is booked.
- A cancel 2 h or less before class promotes no one, `spotsLeft` stays at 0, and a waiter trying to book it directly gets `ClassFull`. Checked after the cancel response, which is when the promotion step has already run.
- A member waiting on two classes is promoted in both.
- A `TestClock` test: a cancel at 2 h + 1 s promotes, and at exactly 2 h it does not.

## Part 3: billing (fake payment provider, no real money)

**Owns**: `src/server/billing/*`, `src/api/BillingApi.ts`, `src/server/seed/billing.ts`, `test/billing.e2e.test.ts`. It replaces the `Entitlements.layerAllowAll` wiring line and deletes that layer.

**Builds**
- A product catalogue in seed: 5-class pack 65 EUR, 10-class pack 120 EUR, monthly 89 EUR, stored as cents (6500, 12000, 8900).
- `PaymentProvider.layerFake`: accepts any token except a documented decline token, never does I/O, and returns a fake ref.
- **`purchase`**: charge first, outside the lock. Then, under `StudioLock`, create the pack or membership and record the purchase as one write. A decline creates nothing. With the fake provider no charge can be left uncommitted, but the order keeps the real-world shape.
- **Packs expire 3 months after purchase** (`expiresAt = purchasedAt + 3 months`). A credit can pay for a class that starts before `expiresAt`. Credits left in an expired pack are lost.
- **Monthly membership**: runs 30 days (`endsAt = startsAt + 30 days`) and stores the purchase's card token for renewal. Buying monthly while one is active gives `AlreadyMember` (409), a new error added to part 0. Renewal does the extending.
- **`renewDue`**: for each membership with `renewal: "active"` whose `endsAt` has passed, charge 89 EUR through `PaymentProvider` with the stored token. On success, extend `endsAt` by 30 days and record a `renewal` purchase. On decline, set `renewal: "failed"`; the membership ends at `endsAt` and is not retried. A `Schedule` fiber runs it every minute. Each renewal commits under `StudioLock` and is idempotent per period.
- `Entitlements` live layer:
  - **`use`**: a membership covering the class start (`startsAt ≤ class start < endsAt`) is used first and costs nothing. Otherwise one credit is taken from the pack that expires soonest and still covers the class start. Otherwise `NoCredit`.
  - **`restore`**: a pack credit goes back to its pack, even if that pack has expired meanwhile, in which case the credit is lost with it. A membership use has nothing to restore.
- Seed members get a mix: one with a pack, one monthly, one with nothing, and one with a last credit.
- Endpoints: `GET /products`, `POST /purchases`, `GET /members/{id}/balance`.

**May not touch**: booking, waitlist, email, staff, contracts.

**Done, via HTTP tests**
- Buy a pack, book until the credits are gone, then `NoCredit`.
- Monthly books without spending credits.
- A declined card gives `PaymentDeclined`, and the balance is unchanged.
- An early cancel returns the pack credit; a late cancel does not.
- Two concurrent monthly purchases: one succeeds, and the other gets `AlreadyMember`.
- `TestClock` tests:
  - A pack can't pay for a class starting after its expiry, and its credits stop counting in the balance.
  - Before 30 days `renewDue` does nothing. After 30 days it renews once (two runs still give one renewal purchase).
  - With the decline token, `renewal` becomes `failed` and the membership stops covering classes after `endsAt`.
- `grep layerAllowAll src` is empty.

## Part 4: emails (local outbox, nothing sent)

**Owns**: `src/server/email/*`, `src/api/OutboxApi.ts`, `test/email.e2e.test.ts`. It replaces the `Outbox.layerDiscard` wiring line.

**Builds**
- An in-memory `Outbox`.
- A subscriber to `BookingEvents`, subscribed while its layer is built. `BookingConfirmed` with `source: member` writes `BookingConfirmed`. `source: waitlist` writes `WaitlistPromoted`, which carries the class details, because a late promotion misses the reminder. Recipients come from `Directory`.
- **`sweepReminders`** writes one `ClassReminder` per `booked` booking whose class starts within the next 24 h. The reminder goes out 24 h before class; a booking made inside 24 h gets its reminder on the next sweep. It never writes duplicates and skips cancelled bookings. A `Schedule` fiber runs it every minute.
- Endpoint: `GET /outbox` (for development and tests; no transport).

**May not touch**: anything outside its files. It reads only through `Bookings`, `Schedule` and `Directory`.

**Done, via HTTP tests**
- Book, then a confirmation is in the outbox. The event subscriber is exercised by calling the outbox's event handler step directly, or by reading after the event has been consumed. Never by polling under `TestClock`.
- A `BookingConfirmed` event with `source: waitlist`, published in-process on `AppLive`, gives a promotion email and no confirmation email. The real promotion path is covered by the final integration test.
- `TestClock` plus a direct `sweepReminders` call: there is no reminder 24 h + 1 min before class, exactly one after the next sweep inside 24 h, still one after a second sweep, and none for a booking cancelled before the sweep.
- No module in `src/server/email` imports a network or SMTP library.

## Part 5: staff dashboard (classes, rosters, check-in)

**Owns**: `src/server/staff/*`, `src/api/StaffApi.ts`, `test/staff.e2e.test.ts`. It adds one line to `Server.ts` for the page route.

**Builds** an HTTP API under `/staff` and a simple web page served by the app. It holds no state of its own and composes the other services.
- `POST /staff/weekly-classes` and `GET /staff/weekly-classes` (via `Schedule`).
- `GET /staff/classes/{id}/roster`: bookings with check-in state, plus the waitlist in order.
- `POST /staff/bookings/{id}/check-in`.
- `GET /staff/members`: credits left, the next pack expiry, membership end and renewal state. Sorted so these come first: memberships ending within 7 days without an active renewal, then packs expiring within 7 days.
- **Staff page** at `GET /staff/`: an `HttpRouter` route returning `HttpServerResponse.html`. It is one self-contained HTML page with inline CSS and a small inline script, with no build step and no external assets.
  - Sections: the week's classes, a roster and waitlist for the chosen class with a check-in button per booking, the members list, and a form to add a weekly class.
  - It calls only the `/staff` JSON endpoints above, so every behaviour it shows is covered by those endpoints' tests.

**May not touch**: any service implementation or contract. If it needs a new service method, it asks the part 0 owner.

**Done, via HTTP tests**
- Add a weekly class, and it appears in `/classes`.
- Roster shows bookings and the waitlist in order.
- Check-in works once, and the second time gives `AlreadyCheckedIn`.
- The members list flags a membership ending soon, or one whose renewal failed, and a pack expiring soon.
- `GET /staff/` returns 200 with `text/html`, and the HTML references each `/staff` endpoint it uses.
- Seen working in the running app (the `run` skill): load the page, check someone in, and confirm the roster updates.

## Final integration (part 0 owner, after all parts)

`test/flow.e2e.test.ts` runs against `ServerLive` with only real layers, and repeats every scenario that a part tested on `AppLive` with a substitute layer:

1. Buy a pack.
2. Book a full class's waitlist.
3. A member with no credits is skipped.
4. A cancel 12 h or more before class restores a credit and promotes.
5. A promotion email appears and no confirmation email does.
6. Run the reminder sweep.
7. Check in.

The gate is green on `main`.

## Answered questions (2026-10-29)

Answered by the human and built into the parts above.

1. **Walk-in spots**: a spot freed 2 h or less before class is blocked for online booking and held for walk-ins only. Built into parts 1 and 2, and closes review finding 9.
2. **No login for now**: `memberId` in the request is fine for the prototype, and `/staff` is unprotected. Affects parts 1, 2 and 5.
3. **Packs expire** 3 months after purchase. Part 3.
4. **Monthly membership** runs 30 days and renews automatically through the fake provider. Part 3.
5. **Reminder** 24 h before class. Part 4.
6. **Staff dashboard** is a simple web page served by the app. Part 5.
7. **Prices**: 5-class pack 65 EUR, 10-class pack 120 EUR, monthly 89 EUR. Part 3.

## Review (Codex, 2026-10-28)

Codex reviewed the first draft of this plan once (`codex exec -s read-only`). Every finding is settled below.

| # | Sev | Finding | Settled |
|---|---|---|---|
| 1 | high | Append-only wiring can't replace `Store` or remove `layerAllowAll`. | **Accepted.** Part 0 owns a scaffold migration. Parts may replace only the lines naming their assigned placeholder or `Store`. |
| 2 | high | New required fields break `Store`/`Seed` constructors, so part 0 can't go green. | **Accepted.** Part 0 migrates the existing constructors, and `weeklyClassId` is optional. |
| 3 | high | Deleting `Store` leaves studio and member data with no owner, and email can't get addresses. | **Accepted.** New `Directory` contract with a real layer in part 0. Booking and email read it. |
| 4 | med | `GET /members/{id}/waitlists` and the `via: waitlist` check exceed the contracts. | **Accepted.** Added `Waitlist.forMember`. `source` is stored on `Booking`. |
| 5 | med | Part 2 can't produce a no-credit skip, and part 4 can't produce a promotion, before the parts they depend on land. | **Accepted.** `AppLive` test seam for substitute layers, with every such scenario repeated against real layers in the final integration test. |
| 6 | high | `SynchronizedRef.modifyEffect` doesn't roll back `Entitlements` changes, and the body is interruptible. | **Accepted.** One `StudioLock` with an uninterruptible body. Failing steps go before the writes that can't fail. `LockHeld` token. |
| 7 | high | An event can be lost between commit and publish. A late subscriber misses early events. | **Accepted.** Publish happens inside the lock. Subscribers subscribe while their layer is built. Promotion no longer uses events at all. |
| 8 | high | A newcomer can take the spot before the async promotion runs. | **Accepted.** Promotion is synchronous inside `cancel`'s lock via the `Promotion` contract. |
| 9 | high | After a late cancel, online booking can take the spot meant for walk-ins. | **Accepted after the human's answer (2026-10-29).** Walk-in holds in part 1 block online booking of a late-freed spot. |
| 10 | high | The 2 h cutoff is checked before the scan rather than at booking time. | **Accepted.** The cutoff is read with `DateTime.now` inside the lock, in the same step that books. |
| 11 | high | Join, leave and promotion race each other. | **Accepted.** `join` and `leave` take `StudioLock`. Promotion runs in the lock. |
| 12 | high | A repeated cancel restores the credit twice. | **Accepted.** Only `booked → cancelled`, otherwise `BookingNotActive`. Concurrent test. |
| 13 | med | Check-in isn't serialised and can succeed on a cancelled booking. | **Accepted.** `checkIn` under the lock, only when `booked`. Concurrent test. |
| 14 | med | Concurrent monthly purchases and partial purchase writes. | **Accepted.** Charge, then commit the entitlement and the purchase record together under the lock. Concurrency test. |
| 15 | med | A bounded retry under `TestClock` never wakes. | **Accepted.** No polling under the virtual clock. Background work is tested through its step functions (`sweepReminders`, the event handler). Promotion is synchronous. |
| 16 | med | Negative async assertions can pass before the work has run. | **Accepted.** Negative checks only after the step has run: after the cancel response for promotion, after a direct sweep for reminders. |
