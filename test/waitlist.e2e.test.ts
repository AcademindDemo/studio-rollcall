import { NodeHttpServer } from "@effect/platform-node"
import { assert, describe, it } from "@effect/vitest"
import { DateTime, Effect, Layer, PubSub, Result } from "effect"
import { HttpApiClient } from "effect/http-api"
import { TestClock } from "effect/testing"
import { Api } from "../src/api/Api.ts"
import { MembershipId, MemberBalance } from "../src/domain/Billing.ts"
import { ClassId } from "../src/domain/ClassSession.ts"
import { NoCredit } from "../src/domain/Errors.ts"
import { MemberId } from "../src/domain/Member.ts"
import { BookingEvents } from "../src/server/contracts/BookingEvents.ts"
import { Bookings } from "../src/server/contracts/Bookings.ts"
import { Entitlements } from "../src/server/contracts/Entitlements.ts"
import { Promotion } from "../src/server/contracts/Promotion.ts"
import { Waitlist } from "../src/server/contracts/Waitlist.ts"
import { demoMembers } from "../src/server/Seed.ts"
import { AppLive, ServerLive } from "../src/server/Server.ts"
import { PromotionLive } from "../src/server/waitlist/PromotionLive.ts"

const ada = demoMembers.ada.id
const bo = demoMembers.bo.id
const chen = demoMembers.chen.id
const dara = demoMembers.dara.id
const yoga = ClassId.make("class-d1-1")
const full = ClassId.make("class-d1-3")
const second = ClassId.make("class-d2-3")
const twoHoursMs = 2 * 60 * 60 * 1000

const server = ServerLive.pipe(Layer.provideMerge(NodeHttpServer.layerTest))

// Refuses Ada and lets everyone else book. AppLive is the seam: the real entitlements
// layer cannot yet refuse one seeded member and allow the next.
const RefusingAda = Layer.succeed(Entitlements)(Entitlements.of({
  use: (_held, memberId, session) => memberId === ada
    ? Effect.fail(new NoCredit({ memberId, classId: session.id }))
    : Effect.succeed({ _tag: "Membership", membershipId: MembershipId.make("allow") }),
  restore: () => Effect.void,
  balance: (memberId) => Effect.succeed(new MemberBalance({ memberId, packCreditsLeft: 1 })),
  listBalances: Effect.succeed([])
}))

// The first waiter's credit check moves the clock across the two-hour line.
const SlowRefuseAda = Layer.succeed(Entitlements)(Entitlements.of({
  use: (_held, memberId, session) => memberId === ada
    ? TestClock.adjust("2 seconds").pipe(Effect.andThen(Effect.fail(new NoCredit({ memberId, classId: session.id }))))
    : Effect.succeed({ _tag: "Membership", membershipId: MembershipId.make("allow") }),
  restore: () => Effect.void,
  balance: (memberId) => Effect.succeed(new MemberBalance({ memberId, packCreditsLeft: 1 })),
  listBalances: Effect.succeed([])
}))

// Time passes between a promotion's cutoff check and its allocate: this one moves the
// clock to exactly two hours before class, then asks Bookings for a waitlist booking.
const LatePromotion = Layer.succeed(Promotion)(Promotion.of({
  onSpotFreed: (held, session) => Effect.gen(function*() {
    const bookings = yield* Bookings
    const now = yield* DateTime.now
    yield* TestClock.adjust(session.startsAt.epochMilliseconds - now.epochMilliseconds - twoHoursMs)
    const result = yield* bookings.allocate(held, session.id, dara, "waitlist").pipe(Effect.result)
    return Result.isSuccess(result) ? [result.success] : []
  })
}))

const lateServer = AppLive.pipe(
  Layer.provide(LatePromotion),
  Layer.provideMerge(RefusingAda),
  Layer.provideMerge(NodeHttpServer.layerTest)
)

const appServer = AppLive.pipe(
  Layer.provide(PromotionLive),
  Layer.provideMerge(RefusingAda),
  Layer.provideMerge(NodeHttpServer.layerTest)
)

const slowServer = AppLive.pipe(
  Layer.provide(PromotionLive),
  Layer.provideMerge(SlowRefuseAda),
  Layer.provideMerge(NodeHttpServer.layerTest)
)

describe("waitlist over HTTP", () => {
  it.effect("rejects a join that is not a full, upcoming class for a free member", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    assert.strictEqual((yield* client.waitlist.join({ params: { id: yoga }, payload: { memberId: ada } }).pipe(Effect.flip))._tag, "ClassNotFull")
    assert.strictEqual((yield* client.waitlist.join({ params: { id: ClassId.make("no-such-class") }, payload: { memberId: ada } }).pipe(Effect.flip))._tag, "ClassNotFound")
    assert.strictEqual((yield* client.waitlist.join({ params: { id: full }, payload: { memberId: MemberId.make("nobody") } }).pipe(Effect.flip))._tag, "MemberNotFound")
    assert.strictEqual((yield* client.waitlist.join({ params: { id: full }, payload: { memberId: bo } }).pipe(Effect.flip))._tag, "AlreadyBooked")
    const joined = yield* client.waitlist.join({ params: { id: full }, payload: { memberId: ada } })
    assert.strictEqual(joined.status, "waiting")
    assert.strictEqual((yield* client.waitlist.join({ params: { id: full }, payload: { memberId: ada } }).pipe(Effect.flip))._tag, "AlreadyWaitlisted")
    const session = yield* (yield* Bookings).listing(full)
    const now = yield* DateTime.now
    yield* TestClock.adjust(session.startsAt.epochMilliseconds - now.epochMilliseconds)
    assert.strictEqual((yield* client.waitlist.join({ params: { id: full }, payload: { memberId: dara } }).pipe(Effect.flip))._tag, "ClassStarted")
    assert.strictEqual((yield* client.waitlist.forMember({ params: { id: MemberId.make("nobody") } }).pipe(Effect.flip))._tag, "MemberNotFound")
  }).pipe(Effect.provide(server)))

  it.effect("leave marks the entry left, and only a waiting entry can be left", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    assert.strictEqual((yield* client.waitlist.leave({ params: { id: full, memberId: ada } }).pipe(Effect.flip))._tag, "NotOnWaitlist")
    yield* client.waitlist.join({ params: { id: full }, payload: { memberId: ada } })
    const left = yield* client.waitlist.leave({ params: { id: full, memberId: ada } })
    assert.strictEqual(left.status, "left")
    assert.strictEqual((yield* client.waitlist.leave({ params: { id: full, memberId: ada } }).pipe(Effect.flip))._tag, "NotOnWaitlist")
    const again = yield* client.waitlist.join({ params: { id: full }, payload: { memberId: ada } })
    assert.strictEqual(again.status, "waiting")
    const mine = yield* client.waitlist.forMember({ params: { id: ada } })
    assert.deepStrictEqual(mine.map((entry) => entry.status), ["left", "waiting"])
  }).pipe(Effect.provide(server)))

  it.effect("a repeated concurrent join joins once", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    const once = client.waitlist.join({ params: { id: full }, payload: { memberId: ada } })
    const repeated = yield* Effect.all([once.pipe(Effect.result), once.pipe(Effect.result)], { concurrency: "unbounded" })
    assert.strictEqual(repeated.filter(Result.isSuccess).length, 1)
    for (const result of repeated) if (Result.isFailure(result)) assert.strictEqual(result.failure._tag, "AlreadyWaitlisted")
    const mine = yield* client.waitlist.forMember({ params: { id: ada } })
    assert.strictEqual(mine.length, 1)
    assert.strictEqual(mine[0]?.status, "waiting")
  }).pipe(Effect.provide(server)))

  it.effect("a cancel promotes the first waiter in that request and leaves the next waiting", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    const events = yield* (yield* BookingEvents).subscribe
    yield* client.waitlist.join({ params: { id: full }, payload: { memberId: ada } })
    yield* TestClock.adjust(1)
    yield* client.waitlist.join({ params: { id: full }, payload: { memberId: dara } })
    const booking = (yield* (yield* Bookings).roster(full)).find((item) => item.memberId === bo && item.status === "booked")
    assert.isDefined(booking)
    const cancelled = yield* client.bookings.cancel({ params: { id: booking.id }, payload: { memberId: bo } })
    assert.strictEqual(cancelled.status, "cancelled")
    const promoted = (yield* client.bookings.forMember({ params: { id: ada } })).find((item) => item.classId === full)
    assert.isDefined(promoted)
    assert.strictEqual(promoted.source, "waitlist")
    assert.strictEqual(promoted.status, "booked")
    assert.strictEqual((yield* client.waitlist.forMember({ params: { id: ada } }))[0]?.status, "promoted")
    assert.strictEqual((yield* client.waitlist.forMember({ params: { id: dara } }))[0]?.status, "waiting")
    assert.strictEqual((yield* client.bookings.forMember({ params: { id: dara } })).length, 0)
    const listed = (yield* client.studio.listClasses()).find((item) => item.id === full)
    assert.isDefined(listed)
    assert.strictEqual(listed.spotsLeft, 0)
    assert.strictEqual(listed.walkInHolds, 0)
    const queue = yield* (yield* Waitlist).forClass(full)
    assert.deepStrictEqual(queue.map((entry) => entry.memberId), [ada, dara])
    const published = yield* PubSub.takeUpTo(events, 10)
    assert.deepStrictEqual(published.map((event) => event._tag), ["BookingCancelled", "BookingConfirmed"])
    assert.strictEqual(published[1]?.booking.memberId, ada)
    assert.strictEqual(published[1]?.booking.source, "waitlist")
  }).pipe(Effect.provide(server)))

  it.effect("a member who left is not promoted, and the next waiter is", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    yield* client.waitlist.join({ params: { id: full }, payload: { memberId: ada } })
    yield* client.waitlist.leave({ params: { id: full, memberId: ada } })
    yield* TestClock.adjust(1)
    yield* client.waitlist.join({ params: { id: full }, payload: { memberId: dara } })
    const booking = (yield* (yield* Bookings).roster(full)).find((item) => item.memberId === bo && item.status === "booked")
    assert.isDefined(booking)
    yield* client.bookings.cancel({ params: { id: booking.id }, payload: { memberId: bo } })
    assert.strictEqual((yield* client.waitlist.forMember({ params: { id: ada } }))[0]?.status, "left")
    assert.strictEqual((yield* client.bookings.forMember({ params: { id: ada } })).length, 0)
    const promoted = (yield* client.bookings.forMember({ params: { id: dara } })).find((item) => item.classId === full)
    assert.isDefined(promoted)
    assert.strictEqual(promoted.source, "waitlist")
    assert.strictEqual((yield* client.waitlist.forMember({ params: { id: dara } }))[0]?.status, "promoted")
  }).pipe(Effect.provide(server)))

  it.effect("a member waiting on two classes is promoted in both", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    yield* client.bookings.book({ payload: { classId: second, memberId: bo } })
    yield* client.bookings.book({ payload: { classId: second, memberId: dara } })
    assert.strictEqual((yield* (yield* Bookings).listing(second)).spotsLeft, 0)
    yield* client.waitlist.join({ params: { id: full }, payload: { memberId: ada } })
    yield* TestClock.adjust(1)
    yield* client.waitlist.join({ params: { id: second }, payload: { memberId: ada } })
    assert.deepStrictEqual((yield* client.waitlist.forMember({ params: { id: ada } })).map((entry) => entry.classId), [full, second])
    const first = (yield* (yield* Bookings).roster(full)).find((item) => item.memberId === bo && item.status === "booked")
    const other = (yield* (yield* Bookings).roster(second)).find((item) => item.memberId === bo && item.status === "booked")
    assert.isDefined(first)
    assert.isDefined(other)
    yield* client.bookings.cancel({ params: { id: first.id }, payload: { memberId: bo } })
    yield* client.bookings.cancel({ params: { id: other.id }, payload: { memberId: bo } })
    const bookings = yield* client.bookings.forMember({ params: { id: ada } })
    assert.deepStrictEqual(bookings.map((item) => item.classId), [full, second])
    assert.deepStrictEqual(bookings.map((item) => item.source), ["waitlist", "waitlist"])
    assert.deepStrictEqual((yield* client.waitlist.forMember({ params: { id: ada } })).map((entry) => entry.status), ["promoted", "promoted"])
  }).pipe(Effect.provide(server)))

  it.effect("an entitlements layer that refuses one member skips that waiter and books the next", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    yield* client.waitlist.join({ params: { id: full }, payload: { memberId: ada } })
    yield* TestClock.adjust(1)
    yield* client.waitlist.join({ params: { id: full }, payload: { memberId: dara } })
    const booking = (yield* (yield* Bookings).roster(full)).find((item) => item.memberId === bo && item.status === "booked")
    assert.isDefined(booking)
    yield* client.bookings.cancel({ params: { id: booking.id }, payload: { memberId: bo } })
    assert.strictEqual((yield* client.waitlist.forMember({ params: { id: ada } }))[0]?.status, "skipped")
    assert.strictEqual((yield* client.bookings.forMember({ params: { id: ada } })).length, 0)
    const promoted = (yield* client.bookings.forMember({ params: { id: dara } })).find((item) => item.classId === full)
    assert.isDefined(promoted)
    assert.strictEqual(promoted.source, "waitlist")
    assert.strictEqual((yield* client.waitlist.forMember({ params: { id: dara } }))[0]?.status, "promoted")
    assert.strictEqual((yield* (yield* Bookings).listing(full)).spotsLeft, 0)
  }).pipe(Effect.provide(appServer)))

  it.effect("does not book the next waiter when skipping crosses the two-hour cutoff", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    yield* client.waitlist.join({ params: { id: full }, payload: { memberId: ada } })
    yield* TestClock.adjust(1)
    yield* client.waitlist.join({ params: { id: full }, payload: { memberId: dara } })
    const session = yield* (yield* Bookings).listing(full)
    const now = yield* DateTime.now
    yield* TestClock.adjust(session.startsAt.epochMilliseconds - now.epochMilliseconds - twoHoursMs - 1000)
    const booking = (yield* (yield* Bookings).roster(full)).find((item) => item.memberId === bo && item.status === "booked")
    assert.isDefined(booking)
    yield* client.bookings.cancel({ params: { id: booking.id }, payload: { memberId: bo } })
    assert.strictEqual((yield* client.waitlist.forMember({ params: { id: ada } }))[0]?.status, "skipped")
    assert.strictEqual((yield* client.waitlist.forMember({ params: { id: dara } }))[0]?.status, "waiting")
    assert.strictEqual((yield* client.bookings.forMember({ params: { id: dara } })).length, 0)
    const after = yield* (yield* Bookings).listing(full)
    assert.strictEqual(after.walkInHolds, 0)
    assert.strictEqual(after.spotsLeft, session.spotsLeft + 1)
  }).pipe(Effect.provide(slowServer)))

  it.effect("a waitlist allocate that reaches the two-hour cutoff books no one and leaves the spot open", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    const session = yield* (yield* Bookings).listing(full)
    const now = yield* DateTime.now
    yield* TestClock.adjust(session.startsAt.epochMilliseconds - now.epochMilliseconds - twoHoursMs - 1000)
    const booking = (yield* (yield* Bookings).roster(full)).find((item) => item.memberId === bo && item.status === "booked")
    assert.isDefined(booking)
    yield* client.bookings.cancel({ params: { id: booking.id }, payload: { memberId: bo } })
    assert.strictEqual((yield* client.bookings.forMember({ params: { id: dara } })).length, 0)
    const after = (yield* client.studio.listClasses()).find((item) => item.id === full)
    assert.isDefined(after)
    assert.strictEqual(after.walkInHolds, 0)
    assert.strictEqual(after.spotsLeft, session.spotsLeft + 1)
  }).pipe(Effect.provide(lateServer)))

  it.effect("when every waiter is skipped the spot is open for online booking", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    const before = yield* (yield* Bookings).listing(full)
    yield* client.waitlist.join({ params: { id: full }, payload: { memberId: ada } })
    const booking = (yield* (yield* Bookings).roster(full)).find((item) => item.memberId === bo && item.status === "booked")
    assert.isDefined(booking)
    yield* client.bookings.cancel({ params: { id: booking.id }, payload: { memberId: bo } })
    assert.strictEqual((yield* client.waitlist.forMember({ params: { id: ada } }))[0]?.status, "skipped")
    const after = yield* (yield* Bookings).listing(full)
    assert.strictEqual(after.spotsLeft, before.spotsLeft + 1)
    assert.strictEqual(after.walkInHolds, 0)
    const booked = yield* client.bookings.book({ payload: { classId: full, memberId: dara } })
    assert.strictEqual(booked.source, "member")
    assert.strictEqual((yield* (yield* Bookings).listing(full)).spotsLeft, before.spotsLeft)
  }).pipe(Effect.provide(appServer)))

  it.effect("a cancel two hours or less before class promotes no one and keeps the spot for walk-ins", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    yield* client.waitlist.join({ params: { id: full }, payload: { memberId: ada } })
    const session = yield* (yield* Bookings).listing(full)
    const now = yield* DateTime.now
    yield* TestClock.adjust(session.startsAt.epochMilliseconds - now.epochMilliseconds - twoHoursMs)
    const booking = (yield* (yield* Bookings).roster(full)).find((item) => item.memberId === bo && item.status === "booked")
    assert.isDefined(booking)
    yield* client.bookings.cancel({ params: { id: booking.id }, payload: { memberId: bo } })
    assert.strictEqual((yield* client.waitlist.forMember({ params: { id: ada } }))[0]?.status, "waiting")
    assert.strictEqual((yield* client.bookings.forMember({ params: { id: ada } })).length, 0)
    const after = (yield* client.studio.listClasses()).find((item) => item.id === full)
    assert.isDefined(after)
    assert.strictEqual(after.spotsLeft, 0)
    assert.strictEqual(after.walkInHolds, 1)
    assert.strictEqual((yield* client.bookings.book({ payload: { classId: full, memberId: ada } }).pipe(Effect.flip))._tag, "ClassFull")
  }).pipe(Effect.provide(server)))

  it.effect("a cancel at two hours plus one second promotes, and at exactly two hours it does not", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    yield* client.waitlist.join({ params: { id: full }, payload: { memberId: ada } })
    yield* TestClock.adjust(1)
    yield* client.waitlist.join({ params: { id: full }, payload: { memberId: dara } })
    const session = yield* (yield* Bookings).listing(full)
    const now = yield* DateTime.now
    yield* TestClock.adjust(session.startsAt.epochMilliseconds - now.epochMilliseconds - twoHoursMs - 1000)
    const early = (yield* (yield* Bookings).roster(full)).find((item) => item.memberId === bo && item.status === "booked")
    assert.isDefined(early)
    yield* client.bookings.cancel({ params: { id: early.id }, payload: { memberId: bo } })
    const promoted = (yield* client.bookings.forMember({ params: { id: ada } })).find((item) => item.classId === full)
    assert.isDefined(promoted)
    assert.strictEqual(promoted.source, "waitlist")
    assert.strictEqual((yield* client.waitlist.forMember({ params: { id: ada } }))[0]?.status, "promoted")
    assert.strictEqual((yield* client.waitlist.forMember({ params: { id: dara } }))[0]?.status, "waiting")
    const open = (yield* client.studio.listClasses()).find((item) => item.id === full)
    assert.isDefined(open)
    assert.strictEqual(open.walkInHolds, 0)
    assert.strictEqual(open.spotsLeft, 0)
    yield* TestClock.adjust("1 second")
    const late = (yield* (yield* Bookings).roster(full)).find((item) => item.memberId === chen && item.status === "booked")
    assert.isDefined(late)
    yield* client.bookings.cancel({ params: { id: late.id }, payload: { memberId: chen } })
    assert.strictEqual((yield* client.waitlist.forMember({ params: { id: dara } }))[0]?.status, "waiting")
    assert.strictEqual((yield* client.bookings.forMember({ params: { id: dara } })).length, 0)
    const held = (yield* client.studio.listClasses()).find((item) => item.id === full)
    assert.isDefined(held)
    assert.strictEqual(held.spotsLeft, 0)
    assert.strictEqual(held.walkInHolds, 1)
    assert.strictEqual((yield* client.bookings.book({ payload: { classId: full, memberId: dara } }).pipe(Effect.flip))._tag, "ClassFull")
  }).pipe(Effect.provide(server)))
})
