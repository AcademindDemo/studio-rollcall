// Final integration: the whole app on ServerLive, with only the real layers, driven over HTTP.
// It also repeats each scenario another part tested on AppLive with a substitute layer.
import { NodeHttpServer } from "@effect/platform-node"
import { assert, describe, it } from "@effect/vitest"
import { DateTime, Effect, Layer, PubSub, Result } from "effect"
import { HttpApiClient } from "effect/http-api"
import { TestClock } from "effect/testing"
import { Api } from "../src/api/Api.ts"
import { CardToken } from "../src/domain/Billing.ts"
import type { BookingId } from "../src/domain/Booking.ts"
import { ClassId } from "../src/domain/ClassSession.ts"
import { BookingEvents } from "../src/server/contracts/BookingEvents.ts"
import { Outbox } from "../src/server/contracts/Outbox.ts"
import { demoMembers } from "../src/server/Seed.ts"
import { ServerLive } from "../src/server/Server.ts"

const server = ServerLive.pipe(Layer.provideMerge(NodeHttpServer.layerTest))

// Seeded balances: Ada monthly, Bo a 10-pack, Chen nothing, Dara a pack with one credit left.
const ada = demoMembers.ada.id
const bo = demoMembers.bo.id
const chen = demoMembers.chen.id
const dara = demoMembers.dara.id
const yoga = ClassId.make("class-d1-1")
const full = ClassId.make("class-d1-3")
const hiit = ClassId.make("class-d2-3")
const dance = ClassId.make("class-d2-2")
const morning = ClassId.make("class-d2-1")
const minuteMs = 60 * 1000
const hourMs = 60 * minuteMs
const dayMs = 24 * hourMs

// Moves the test clock to `before` milliseconds before the class starts.
const moveTo = (startsAt: DateTime.Utc, before: number) => Effect.gen(function*() {
  const now = yield* DateTime.now
  yield* TestClock.adjust(startsAt.epochMilliseconds - before - now.epochMilliseconds)
})

describe("final integration over HTTP on ServerLive", () => {
  it.effect("buy, fill, wait, skip, cancel and promote, email, remind, check in", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    const outbox = yield* Outbox
    const events = yield* (yield* BookingEvents).subscribe

    // 1. Chen, who has nothing, buys a 5-class pack from the fake provider.
    assert.strictEqual((yield* client.billing.balance({ params: { id: chen } })).packCreditsLeft, 0)
    const purchase = yield* client.billing.purchase({ payload: { memberId: chen, productId: "pack-5", cardToken: CardToken.make("fake-card") } })
    assert.strictEqual(purchase.amountCents, 6500)
    assert.strictEqual(purchase.reason, "purchase")
    assert.strictEqual((yield* client.billing.balance({ params: { id: chen } })).packCreditsLeft, 5)

    // Dara spends her last credit elsewhere, so she has none when the spot opens.
    yield* client.bookings.book({ payload: { classId: yoga, memberId: dara } })
    assert.strictEqual((yield* client.billing.balance({ params: { id: dara } })).packCreditsLeft, 0)

    // 2. Chen and Bo fill the two-spot HIIT class; Dara, then Ada, join its waitlist.
    const chenBooking = yield* client.bookings.book({ payload: { classId: hiit, memberId: chen } })
    assert.strictEqual(chenBooking.creditUse._tag, "PackCredit")
    assert.strictEqual((yield* client.billing.balance({ params: { id: chen } })).packCreditsLeft, 4)
    const boBooking = yield* client.bookings.book({ payload: { classId: hiit, memberId: bo } })
    const session = (yield* client.studio.listClasses()).find((c) => c.id === hiit)
    assert.isDefined(session)
    assert.strictEqual(session.spotsLeft, 0)
    assert.strictEqual((yield* client.bookings.book({ payload: { classId: hiit, memberId: ada } }).pipe(Effect.flip))._tag, "ClassFull")
    yield* client.waitlist.join({ params: { id: hiit }, payload: { memberId: dara } })
    yield* TestClock.adjust(1)
    yield* client.waitlist.join({ params: { id: hiit }, payload: { memberId: ada } })

    // 3 and 4. Chen cancels 24 h + 1 min before class, before its reminder window opens and
    // well over 12 h ahead ("exactly 12 h" has its own test below): the credit comes back,
    // and in the same request Dara (no credit) is skipped and Ada is booked from the waitlist.
    yield* moveTo(session.startsAt, dayMs + minuteMs)
    const cancelled = yield* client.bookings.cancel({ params: { id: chenBooking.id }, payload: { memberId: chen } })
    assert.strictEqual(cancelled.status, "cancelled")
    assert.strictEqual((yield* client.billing.balance({ params: { id: chen } })).packCreditsLeft, 5)
    assert.strictEqual((yield* client.waitlist.forMember({ params: { id: dara } }))[0]?.status, "skipped")
    assert.lengthOf((yield* client.bookings.forMember({ params: { id: dara } })).filter((b) => b.classId === hiit), 0)
    assert.strictEqual((yield* client.waitlist.forMember({ params: { id: ada } }))[0]?.status, "promoted")
    const promoted = (yield* client.bookings.forMember({ params: { id: ada } })).find((b) => b.classId === hiit)
    assert.isDefined(promoted)
    assert.strictEqual(promoted.source, "waitlist")
    assert.strictEqual(promoted.status, "booked")
    assert.strictEqual(promoted.creditUse._tag, "Membership")
    assert.strictEqual((yield* client.studio.listClasses()).find((c) => c.id === hiit)?.spotsLeft, 0)

    // The cancel published its events, promotion included, before it returned.
    const published = yield* PubSub.takeUpTo(events, 100)
    assert.deepStrictEqual(published.slice(-2).map((e) => [e._tag, e.booking.id]), [
      ["BookingCancelled", chenBooking.id], ["BookingConfirmed", promoted.id]
    ])
    const cancelEvent = published.at(-2)
    assert.isTrue(cancelEvent?._tag === "BookingCancelled" && cancelEvent.creditReturned)

    // 5. Run the outbox's event step for each published event (the subscriber runs the same
    // idempotent step), then read: a promotion email for Ada and no confirmation for it.
    for (const event of published) yield* outbox.onEvent(event)
    const promotedEmails = yield* client.outbox.list({ query: { bookingId: promoted.id } })
    assert.deepStrictEqual(promotedEmails.map((e) => [e.kind, e.to]), [["WaitlistPromoted", demoMembers.ada.email]])
    assert.isTrue(promotedEmails[0]?.body.includes(session.room))
    assert.lengthOf(yield* client.outbox.list({ query: { bookingId: promoted.id, kind: "BookingConfirmed" } }), 0)
    // A member's own booking gets a confirmation and no promotion email.
    assert.lengthOf(yield* client.outbox.list({ query: { bookingId: boBooking.id, kind: "BookingConfirmed" } }), 1)
    assert.lengthOf(yield* client.outbox.list({ query: { bookingId: boBooking.id, kind: "WaitlistPromoted" } }), 0)

    // A sweep 24 h + 1 min before class reminds no one of it.
    yield* outbox.sweepReminders
    for (const booking of [chenBooking, boBooking, promoted]) {
      assert.lengthOf(yield* client.outbox.list({ query: { bookingId: booking.id, kind: "ClassReminder" } }), 0)
    }

    // 6. 12 h before class, the sweep reminds every booked booking whose class starts within
    // 24 h, once, and not Chen's cancelled one.
    yield* moveTo(session.startsAt, 12 * hourMs)
    const now = yield* DateTime.now
    const inWindow = (yield* client.studio.listClasses()).filter((c) =>
      c.startsAt.epochMilliseconds >= now.epochMilliseconds && c.startsAt.epochMilliseconds <= now.epochMilliseconds + dayMs)
    const due: Array<BookingId> = []
    const anyStatus: Array<BookingId> = []
    for (const c of inWindow) {
      const roster = yield* client.staff.roster({ params: { id: c.id } })
      for (const b of roster.bookings) {
        anyStatus.push(b.id)
        if (b.status === "booked") due.push(b.id)
      }
    }
    assert.includeMembers(due, [boBooking.id, promoted.id])
    assert.notInclude(due, chenBooking.id)
    // The outbox's own sweep fiber also ran while the clock moved, so read the outbox after
    // this sweep rather than relying on what this sweep returned.
    const remindersFor = (id: BookingId) => client.outbox.list({ query: { bookingId: id, kind: "ClassReminder" } })
    for (const sweep of [1, 2]) {
      yield* outbox.sweepReminders
      for (const id of due) assert.lengthOf(yield* remindersFor(id), 1, `booking ${id} after sweep ${sweep}`)
      assert.lengthOf(yield* remindersFor(chenBooking.id), 0)
    }
    const reminded = (yield* client.outbox.list({ query: { kind: "ClassReminder" } })).map((e) => e.bookingId)
    assert.sameMembers(reminded.filter((id) => anyStatus.includes(id)), due)
    // A booking made inside the window is reminded on the next sweep, once.
    const lateBooking = yield* client.bookings.book({ payload: { classId: dance, memberId: chen } })
    assert.lengthOf(yield* remindersFor(lateBooking.id), 0)
    yield* outbox.sweepReminders
    assert.lengthOf(yield* remindersFor(lateBooking.id), 1)
    yield* outbox.sweepReminders
    assert.lengthOf(yield* remindersFor(lateBooking.id), 1)

    // 7. Two concurrent check-ins of Ada's promoted booking: exactly one succeeds.
    const checkIn = client.staff.checkIn({ params: { id: promoted.id } })
    const results = yield* Effect.all([checkIn.pipe(Effect.result), checkIn.pipe(Effect.result)], { concurrency: "unbounded" })
    assert.strictEqual(results.filter(Result.isSuccess).length, 1)
    for (const result of results) {
      if (Result.isFailure(result)) assert.strictEqual(result.failure._tag, "AlreadyCheckedIn")
      else assert.deepStrictEqual(result.success.checkedInAt, now)
    }
    const roster = yield* client.staff.roster({ params: { id: hiit } })
    assert.deepStrictEqual(roster.bookings.find((b) => b.id === promoted.id)?.checkedInAt, now)
    assert.deepStrictEqual(roster.waitlist.map((w) => [w.memberId, w.status]), [[dara, "skipped"], [ada, "promoted"]])
    assert.strictEqual((yield* checkIn.pipe(Effect.flip))._tag, "AlreadyCheckedIn")
    assert.strictEqual((yield* client.staff.checkIn({ params: { id: chenBooking.id } }).pipe(Effect.flip))._tag, "BookingNotActive")
  }).pipe(Effect.provide(server)))

  // contracts "AppLive test seam" (refusing Entitlements); booking "books, lists ..." and
  // "rejects booking and cancellation at class start" (counting Entitlements).
  it.effect("a member with nothing gets NoCredit; booking, duplicates, a full class and class start", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    const before = (yield* client.studio.listClasses()).find((c) => c.id === yoga)
    assert.isDefined(before)
    assert.strictEqual((yield* client.bookings.book({ payload: { classId: yoga, memberId: chen } }).pipe(Effect.flip))._tag, "NoCredit")
    assert.strictEqual((yield* client.studio.listClasses()).find((c) => c.id === yoga)?.spotsLeft, before.spotsLeft)

    const booking = yield* client.bookings.book({ payload: { classId: yoga, memberId: bo } })
    assert.strictEqual(booking.source, "member")
    assert.strictEqual(booking.creditUse._tag, "PackCredit")
    assert.strictEqual((yield* client.studio.listClasses()).find((c) => c.id === yoga)?.spotsLeft, before.spotsLeft - 1)
    assert.deepStrictEqual((yield* client.bookings.forMember({ params: { id: bo } })).filter((b) => b.classId === yoga).map((b) => b.id), [booking.id])
    assert.strictEqual((yield* client.bookings.book({ payload: { classId: yoga, memberId: bo } }).pipe(Effect.flip))._tag, "AlreadyBooked")
    assert.strictEqual((yield* client.bookings.book({ payload: { classId: full, memberId: ada } }).pipe(Effect.flip))._tag, "ClassFull")

    yield* moveTo(before.startsAt, 0)
    assert.strictEqual((yield* client.bookings.book({ payload: { classId: yoga, memberId: ada } }).pipe(Effect.flip))._tag, "ClassStarted")
    assert.strictEqual((yield* client.bookings.cancel({ params: { id: booking.id }, payload: { memberId: bo } }).pipe(Effect.flip))._tag, "ClassStarted")
  }).pipe(Effect.provide(server)))

  // booking "returns exactly the recorded credit at 12 hours, but not one second inside".
  it.effect("a pack credit comes back at exactly 12 h, and not one second inside", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    const events = yield* (yield* BookingEvents).subscribe
    const session = (yield* client.studio.listClasses()).find((c) => c.id === morning)
    assert.isDefined(session)
    const early = yield* client.bookings.book({ payload: { classId: morning, memberId: bo } })
    const late = yield* client.bookings.book({ payload: { classId: morning, memberId: dara } })
    assert.strictEqual((yield* client.billing.balance({ params: { id: bo } })).packCreditsLeft, 9)
    assert.strictEqual((yield* client.billing.balance({ params: { id: dara } })).packCreditsLeft, 0)

    yield* moveTo(session.startsAt, 12 * hourMs)
    yield* client.bookings.cancel({ params: { id: early.id }, payload: { memberId: bo } })
    assert.strictEqual((yield* client.billing.balance({ params: { id: bo } })).packCreditsLeft, 10)
    yield* TestClock.adjust("1 second")
    yield* client.bookings.cancel({ params: { id: late.id }, payload: { memberId: dara } })
    assert.strictEqual((yield* client.billing.balance({ params: { id: dara } })).packCreditsLeft, 0)
    assert.strictEqual((yield* client.billing.balance({ params: { id: bo } })).packCreditsLeft, 10)

    const cancels = (yield* PubSub.takeUpTo(events, 10)).flatMap((e) => e._tag === "BookingCancelled" ? [e.creditReturned] : [])
    assert.deepStrictEqual(cancels, [true, false])
  }).pipe(Effect.provide(server)))

  // booking "rejects another member and restores and publishes only once for concurrent cancels".
  it.effect("another member can't cancel, and concurrent cancels restore the pack credit once", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    const events = yield* (yield* BookingEvents).subscribe
    const booking = yield* client.bookings.book({ payload: { classId: yoga, memberId: bo } })
    assert.strictEqual((yield* client.bookings.cancel({ params: { id: booking.id }, payload: { memberId: chen } }).pipe(Effect.flip))._tag, "NotYourBooking")
    assert.strictEqual((yield* client.billing.balance({ params: { id: bo } })).packCreditsLeft, 9)

    const cancel = client.bookings.cancel({ params: { id: booking.id }, payload: { memberId: bo } })
    const results = yield* Effect.all([cancel.pipe(Effect.result), cancel.pipe(Effect.result)], { concurrency: "unbounded" })
    assert.strictEqual(results.filter(Result.isSuccess).length, 1)
    for (const result of results) if (Result.isFailure(result)) assert.strictEqual(result.failure._tag, "BookingNotActive")
    assert.strictEqual((yield* cancel.pipe(Effect.flip))._tag, "BookingNotActive")
    assert.strictEqual((yield* client.billing.balance({ params: { id: bo } })).packCreditsLeft, 10)
    assert.deepStrictEqual((yield* PubSub.takeUpTo(events, 10)).map((e) => e._tag), ["BookingConfirmed", "BookingCancelled"])
  }).pipe(Effect.provide(server)))

  // waitlist "when every waiter is skipped the spot is open for online booking" (refusing
  // Entitlements); booking "a spot freed more than two hours before start remains bookable".
  it.effect("when the only waiter has no credit, the freed spot is open for online booking", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    yield* client.bookings.book({ payload: { classId: yoga, memberId: dara } })
    yield* client.waitlist.join({ params: { id: full }, payload: { memberId: dara } })
    const before = yield* client.staff.roster({ params: { id: full } })
    const seeded = before.bookings.find((b) => b.memberId === bo)
    assert.isDefined(seeded)

    yield* moveTo(before.classListing.startsAt, 2 * hourMs + 1000)
    yield* client.bookings.cancel({ params: { id: seeded.id }, payload: { memberId: bo } })
    assert.strictEqual((yield* client.waitlist.forMember({ params: { id: dara } }))[0]?.status, "skipped")
    const after = (yield* client.studio.listClasses()).find((c) => c.id === full)
    assert.isDefined(after)
    assert.strictEqual(after.spotsLeft, 1)
    assert.strictEqual(after.walkInHolds, 0)
    const booked = yield* client.bookings.book({ payload: { classId: full, memberId: ada } })
    assert.strictEqual(booked.source, "member")
    assert.strictEqual((yield* client.studio.listClasses()).find((c) => c.id === full)?.spotsLeft, 0)
  }).pipe(Effect.provide(server)))

  // booking "a cancellation at exactly two hours holds the freed spot for walk-ins" (a substitute
  // Promotion) and "HTTP listings remain consistent while full-class late cancellations run concurrently".
  it.effect("late cancels at exactly 2 h promote no one and hold both spots for walk-ins", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    yield* client.waitlist.join({ params: { id: full }, payload: { memberId: ada } })
    const before = yield* client.staff.roster({ params: { id: full } })
    yield* moveTo(before.classListing.startsAt, 2 * hourMs)
    yield* Effect.all([
      Effect.forEach(before.bookings, (b) => client.bookings.cancel({ params: { id: b.id }, payload: { memberId: b.memberId } }),
        { concurrency: "unbounded" }),
      Effect.forEach(Array.from({ length: 30 }), () => client.studio.listClasses().pipe(Effect.map((classes) => {
        assert.strictEqual(classes.find((c) => c.id === full)?.spotsLeft, 0)
      })), { concurrency: "unbounded" })
    ], { concurrency: "unbounded" })
    const after = (yield* client.studio.listClasses()).find((c) => c.id === full)
    assert.isDefined(after)
    assert.strictEqual(after.spotsLeft, 0)
    assert.strictEqual(after.walkInHolds, 2)
    assert.strictEqual((yield* client.waitlist.forMember({ params: { id: ada } }))[0]?.status, "waiting")
    assert.strictEqual((yield* client.bookings.book({ payload: { classId: full, memberId: ada } }).pipe(Effect.flip))._tag, "ClassFull")
  }).pipe(Effect.provide(server)))

  // staff "flags a membership ending soon ...", "the 7-day window includes its last instant ..."
  // and "with the real billing layers, flags a failed renewal ...": the pack part, which the
  // real layers can produce.
  it.effect("the staff members list flags packs expiring within 7 days, edges included", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    const expiry = (yield* client.billing.balance({ params: { id: bo } })).nextPackExpiry
    assert.isDefined(expiry)
    const flags = Effect.map(client.staff.members(), (rows) => rows.map((r) => [r.member.id, r.flags]))

    yield* TestClock.setTime(expiry.epochMilliseconds - 7 * dayMs - 1)
    assert.deepStrictEqual(yield* flags, [[ada, []], [bo, []], [chen, []], [dara, []]])
    yield* TestClock.setTime(expiry.epochMilliseconds - 7 * dayMs)
    assert.deepStrictEqual(yield* flags, [[bo, ["packExpiringSoon"]], [dara, ["packExpiringSoon"]], [ada, []], [chen, []]])
    yield* TestClock.setTime(expiry.epochMilliseconds)
    assert.deepStrictEqual(yield* flags, [[ada, []], [bo, []], [chen, []], [dara, []]])
    assert.strictEqual((yield* client.billing.balance({ params: { id: bo } })).packCreditsLeft, 0)
  }).pipe(Effect.provide(server)))
})
