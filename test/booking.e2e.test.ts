import { NodeHttpServer } from "@effect/platform-node"
import { assert, describe, it } from "@effect/vitest"
import { Context, DateTime, Effect, Layer, PubSub, Ref, Result } from "effect"
import { HttpApiBuilder, HttpApiClient, HttpApiEndpoint, HttpApiGroup } from "effect/http-api"
import { HttpRouter } from "effect/http"
import { TestClock } from "effect/testing"
import { Api } from "../src/api/Api.ts"
import { MemberBalance, ClassPackId } from "../src/domain/Billing.ts"
import { Booking, CheckInInput } from "../src/domain/Booking.ts"
import { AlreadyCheckedIn, BookingNotActive, BookingNotFound } from "../src/domain/Errors.ts"
import { ClassId } from "../src/domain/ClassSession.ts"
import { BookingEvents } from "../src/server/contracts/BookingEvents.ts"
import { Bookings } from "../src/server/contracts/Bookings.ts"
import { Entitlements } from "../src/server/contracts/Entitlements.ts"
import { Promotion } from "../src/server/contracts/Promotion.ts"
import { demoMembers } from "../src/server/Seed.ts"
import { AppLive } from "../src/server/Server.ts"
import { BookingsLive } from "../src/server/booking/BookingsLive.ts"
import { CoreLive } from "../src/server/core/CoreLive.ts"
import { HandlersLive } from "../src/server/Handlers.ts"
import { ScheduleLive } from "../src/server/schedule/ScheduleLive.ts"

class Restores extends Context.Service<Restores, Ref.Ref<ReadonlyArray<string>>>()("test/booking/Restores") {}

const CountingCredits = Layer.effect(Restores, Ref.make<ReadonlyArray<string>>([]))
const Credits = Layer.effect(Entitlements, Effect.gen(function*() {
  const restored = yield* Restores
  return Entitlements.of({
    use: (_held, memberId) => Effect.succeed({ _tag: "PackCredit", packId: ClassPackId.make(memberId) }),
    restore: (_held, credit) => Ref.update(restored, (all) => [...all, credit._tag === "PackCredit" ? credit.packId : credit.membershipId]),
    balance: (memberId) => Effect.succeed(new MemberBalance({ memberId, packCreditsLeft: 10 })),
    listBalances: Effect.succeed([])
  })
})).pipe(Layer.provideMerge(CountingCredits))

// A promotion step that allocates under cancel's token. Its synchronous result and event
// demonstrate that the Bookings service passed at call time is the same live instance.
const PromoteDara = Layer.succeed(Promotion)(Promotion.of({
  onSpotFreed: (held, session) => Effect.gen(function*() {
    const now = yield* DateTime.now
    if (session.startsAt.epochMilliseconds - now.epochMilliseconds <= 2 * 60 * 60 * 1000) return []
    const bookings = yield* Bookings
    const result = yield* bookings.allocate(held, session.id, demoMembers.dara.id, "waitlist").pipe(Effect.result)
    return Result.isSuccess(result) ? [result.success] : []
  })
}))
const NoPromotion = Layer.succeed(Promotion)(Promotion.of({ onSpotFreed: () => Effect.succeed([]) }))
const server = (promotion = NoPromotion) => AppLive.pipe(
  Layer.provide(promotion),
  Layer.provideMerge(Credits),
  Layer.provideMerge(NodeHttpServer.layerTest)
)

// Part 5 owns the production staff route. This test-only API adds a wire adapter
// to the real member handlers and live services, without adding a product endpoint.
const CheckInApi = Api.add(HttpApiGroup.make("checkInTest").add(
  HttpApiEndpoint.post("checkIn", "/test/check-in", {
    payload: CheckInInput, success: Booking, error: [BookingNotFound, BookingNotActive, AlreadyCheckedIn]
  })
))
const CheckInHandlers = HttpApiBuilder.group(CheckInApi, "checkInTest", Effect.fn(function*(handlers) {
  const bookings = yield* Bookings
  return handlers.handle("checkIn", ({ payload }) => bookings.checkIn(payload))
}))
const CheckInServer = HttpRouter.serve(HttpApiBuilder.layer(CheckInApi).pipe(
  Layer.provide(CheckInHandlers), Layer.provide(HandlersLive)
)).pipe(
  Layer.provideMerge(BookingsLive), Layer.provideMerge(ScheduleLive), Layer.provideMerge(CoreLive),
  Layer.provide(NoPromotion), Layer.provideMerge(Credits), Layer.provideMerge(NodeHttpServer.layerTest)
)

const ada = demoMembers.ada.id
const bo = demoMembers.bo.id
const target = ClassId.make("class-d1-1")
const full = ClassId.make("class-d1-3")

// Each test builds an isolated real HTTP server under its own TestClock.
describe("booking over HTTP", () => {
  it.effect("books, lists member bookings, rejects duplicates and a full class", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    const before = yield* client.studio.listClasses()
    const session = before.find((c) => c.id === target)
    assert.isDefined(session)
    const booking = yield* client.bookings.book({ payload: { classId: target, memberId: ada } })
    assert.strictEqual(booking.status, "booked")
    assert.strictEqual(booking.source, "member")
    assert.strictEqual(booking.creditUse._tag, "PackCredit")
    assert.strictEqual((yield* client.studio.listClasses()).find((c) => c.id === target)?.spotsLeft, session.spotsLeft - 1)
    assert.deepStrictEqual((yield* client.bookings.forMember({ params: { id: ada } })).map((b) => b.id), [booking.id])
    assert.strictEqual((yield* client.bookings.book({ payload: { classId: target, memberId: ada } }).pipe(Effect.flip))._tag, "AlreadyBooked")
    assert.strictEqual((yield* client.bookings.book({ payload: { classId: full, memberId: ada } }).pipe(Effect.flip))._tag, "ClassFull")
  }).pipe(Effect.provide(server())))

  it.effect("rejects booking and cancellation at class start", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    const session = yield* (yield* Bookings).listing(target)
    const booking = yield* client.bookings.book({ payload: { classId: target, memberId: ada } })
    const now = yield* DateTime.now
    yield* TestClock.adjust(session.startsAt.epochMilliseconds - now.epochMilliseconds)
    assert.strictEqual((yield* client.bookings.book({ payload: { classId: target, memberId: bo } }).pipe(Effect.flip))._tag, "ClassStarted")
    assert.strictEqual((yield* client.bookings.cancel({ params: { id: booking.id }, payload: { memberId: ada } }).pipe(Effect.flip))._tag, "ClassStarted")
  }).pipe(Effect.provide(server())))

  it.effect("returns exactly the recorded credit at 12 hours, but not one second inside", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    const events = yield* (yield* BookingEvents).subscribe
    const session = yield* (yield* Bookings).listing(target)
    const first = yield* client.bookings.book({ payload: { classId: target, memberId: ada } })
    const second = yield* client.bookings.book({ payload: { classId: target, memberId: bo } })
    const now = yield* DateTime.now
    yield* TestClock.adjust(session.startsAt.epochMilliseconds - now.epochMilliseconds - 12 * 60 * 60 * 1000)
    const cancelled = yield* client.bookings.cancel({ params: { id: first.id }, payload: { memberId: ada } })
    assert.strictEqual(cancelled.status, "cancelled")
    assert.deepStrictEqual(yield* Ref.get(yield* Restores), [ada])
    yield* TestClock.adjust("1 second")
    yield* client.bookings.cancel({ params: { id: second.id }, payload: { memberId: bo } })
    assert.deepStrictEqual(yield* Ref.get(yield* Restores), [ada])
    const all = yield* PubSub.takeUpTo(events, 10)
    assert.deepStrictEqual(all.filter((e) => e._tag === "BookingCancelled").map((e) => e.creditReturned), [true, false])
  }).pipe(Effect.provide(server())))

  it.effect("rejects another member and restores and publishes only once for concurrent cancels", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    const events = yield* (yield* BookingEvents).subscribe
    const booking = yield* client.bookings.book({ payload: { classId: target, memberId: ada } })
    assert.strictEqual((yield* client.bookings.cancel({ params: { id: booking.id }, payload: { memberId: bo } }).pipe(Effect.flip))._tag, "NotYourBooking")
    assert.deepStrictEqual(yield* Ref.get(yield* Restores), [])
    const cancel = client.bookings.cancel({ params: { id: booking.id }, payload: { memberId: ada } })
    const results = yield* Effect.all([cancel.pipe(Effect.result), cancel.pipe(Effect.result)], { concurrency: "unbounded" })
    assert.strictEqual(results.filter(Result.isSuccess).length, 1)
    for (const result of results) if (Result.isFailure(result)) assert.strictEqual(result.failure._tag, "BookingNotActive")
    assert.strictEqual((yield* cancel.pipe(Effect.flip))._tag, "BookingNotActive")
    assert.deepStrictEqual(yield* Ref.get(yield* Restores), [ada])
    const all = yield* PubSub.takeUpTo(events, 10)
    assert.deepStrictEqual(all.map((e) => e._tag), ["BookingConfirmed", "BookingCancelled"])
  }).pipe(Effect.provide(server())))

  it.effect("two concurrent HTTP check-ins succeed exactly once and cancelled bookings cannot check in", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(CheckInApi)
    const booking = yield* client.bookings.book({ payload: { classId: target, memberId: ada } })
    const results = yield* Effect.all([
      client.checkInTest.checkIn({ payload: { bookingId: booking.id } }).pipe(Effect.result),
      client.checkInTest.checkIn({ payload: { bookingId: booking.id } }).pipe(Effect.result)
    ], { concurrency: "unbounded" })
    assert.strictEqual(results.filter(Result.isSuccess).length, 1)
    for (const result of results) {
      if (Result.isFailure(result)) assert.strictEqual(result.failure._tag, "AlreadyCheckedIn")
      else assert.isDefined(result.success.checkedInAt)
    }
    const listed = yield* client.bookings.forMember({ params: { id: ada } })
    assert.isDefined(listed[0]?.checkedInAt)
    yield* client.bookings.cancel({ params: { id: booking.id }, payload: { memberId: ada } })
    assert.strictEqual((yield* client.checkInTest.checkIn({ payload: { bookingId: booking.id } }).pipe(Effect.flip))._tag, "BookingNotActive")
  }).pipe(Effect.provide(CheckInServer)))

  it.effect("publishes booking, cancellation and promotion before returning from cancel", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    const subscription = yield* (yield* BookingEvents).subscribe
    const booking = yield* client.bookings.book({ payload: { classId: target, memberId: ada } })
    yield* client.bookings.cancel({ params: { id: booking.id }, payload: { memberId: ada } })
    const events = yield* PubSub.takeUpTo(subscription, 10)
    assert.deepStrictEqual(events.map((e) => e._tag), ["BookingConfirmed", "BookingCancelled", "BookingConfirmed"])
    assert.strictEqual(events[2]?.booking.source, "waitlist")
    const promoted = yield* client.bookings.forMember({ params: { id: demoMembers.dara.id } })
    assert.strictEqual(promoted[0]?.source, "waitlist")
  }).pipe(Effect.provide(server(PromoteDara))))

  it.effect("a spot freed more than two hours before start remains bookable when promotion leaves it open", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    const bookings = yield* Bookings
    const session = yield* bookings.listing(full)
    const booking = (yield* bookings.roster(full))[0]
    assert.isDefined(booking)
    const now = yield* DateTime.now
    yield* TestClock.adjust(session.startsAt.epochMilliseconds - now.epochMilliseconds - 2 * 60 * 60 * 1000 - 1000)
    yield* client.bookings.cancel({ params: { id: booking.id }, payload: { memberId: booking.memberId } })
    const after = (yield* client.studio.listClasses()).find((c) => c.id === full)
    assert.isDefined(after)
    assert.strictEqual(after.walkInHolds, 0)
    assert.strictEqual(after.spotsLeft, session.spotsLeft + 1)
    yield* client.bookings.book({ payload: { classId: full, memberId: ada } })
    assert.strictEqual((yield* bookings.listing(full)).spotsLeft, 0)
  }).pipe(Effect.provide(server())))

  it.effect("HTTP listings remain consistent while full-class late cancellations run concurrently", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    const bookings = yield* Bookings
    const session = yield* bookings.listing(full)
    const roster = yield* bookings.roster(full)
    const now = yield* DateTime.now
    yield* TestClock.adjust(session.startsAt.epochMilliseconds - now.epochMilliseconds - 2 * 60 * 60 * 1000)
    yield* Effect.all([
      Effect.forEach(roster, (booking) => client.bookings.cancel({ params: { id: booking.id }, payload: { memberId: booking.memberId } }), { concurrency: "unbounded" }).pipe(Effect.asVoid),
      Effect.forEach(Array.from({ length: 30 }), () => client.studio.listClasses().pipe(Effect.map((classes) => {
        const listed = classes.find((c) => c.id === full)
        assert.isDefined(listed)
        assert.strictEqual(listed.spotsLeft, 0)
      })), { concurrency: "unbounded" }).pipe(Effect.asVoid)
    ], { concurrency: "unbounded" })
    const after = (yield* client.studio.listClasses()).find((c) => c.id === full)
    assert.isDefined(after)
    assert.strictEqual(after.walkInHolds, 2)
    assert.strictEqual(after.spotsLeft, 0)
  }).pipe(Effect.provide(server())))

  it.effect("a cancellation at exactly two hours holds the freed spot for walk-ins", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    const service = yield* Bookings
    const before = yield* service.listing(full)
    const roster = yield* service.roster(full)
    const booking = roster[0]
    assert.isDefined(booking)
    const now = yield* DateTime.now
    yield* TestClock.adjust(before.startsAt.epochMilliseconds - now.epochMilliseconds - 2 * 60 * 60 * 1000)
    yield* client.bookings.cancel({ params: { id: booking.id }, payload: { memberId: booking.memberId } })
    const after = (yield* client.studio.listClasses()).find((c) => c.id === full)
    const retained = yield* service.listing(full)
    assert.strictEqual(retained.spotsLeft, before.spotsLeft)
    assert.strictEqual(retained.walkInHolds, 1)
    assert.isDefined(after)
    assert.strictEqual(after.spotsLeft, before.spotsLeft)
    assert.strictEqual((yield* client.bookings.book({ payload: { classId: full, memberId: ada } }).pipe(Effect.flip))._tag, "ClassFull")
  }).pipe(Effect.provide(server(PromoteDara))))
})
