import { NodeHttpServer } from "@effect/platform-node"
import { assert, describe, it, layer } from "@effect/vitest"
import { Context, DateTime, Effect, Exit, Fiber, Latch, Layer, PubSub, Queue, Ref } from "effect"
import { HttpApiClient } from "effect/http-api"
import { Api } from "../src/api/Api.ts"
import { MemberBalance, MembershipId } from "../src/domain/Billing.ts"
import { Booking, BookingId } from "../src/domain/Booking.ts"
import { ClassId } from "../src/domain/ClassSession.ts"
import { NoCredit, PaymentDeclined } from "../src/domain/Errors.ts"
import { BookingConfirmed } from "../src/domain/Events.ts"
import type { BookingEvent } from "../src/domain/Events.ts"
import { BookingEvents } from "../src/server/contracts/BookingEvents.ts"
import { Entitlements } from "../src/server/contracts/Entitlements.ts"
import { PaymentProvider } from "../src/server/contracts/PaymentProvider.ts"
import { Promotion } from "../src/server/contracts/Promotion.ts"
import { StudioLock } from "../src/server/contracts/StudioLock.ts"
import { CoreLive } from "../src/server/core/CoreLive.ts"
import { demoMembers } from "../src/server/Seed.ts"
import { AppLive, ServerLive } from "../src/server/Server.ts"

describe("StudioLock", () => {
  it.effect("runs the body uninterruptibly", () =>
    Effect.gen(function*() {
      const lock = yield* StudioLock
      const started = yield* Latch.make()
      const release = yield* Latch.make()
      const finished = yield* Ref.make(false)

      const fiber = yield* lock.withLock(() =>
        started.open.pipe(
          Effect.andThen(release.await),
          Effect.andThen(Ref.set(finished, true))
        )
      ).pipe(Effect.forkChild)
      yield* started.await

      // The interrupt can't stop the body; it waits until the body has finished.
      const interrupter = yield* Fiber.interrupt(fiber).pipe(Effect.forkChild)
      yield* Effect.yieldNow
      assert.isFalse(yield* Ref.get(finished))
      assert.isUndefined(interrupter.pollUnsafe())

      yield* release.open
      yield* Fiber.join(interrupter)
      assert.isTrue(yield* Ref.get(finished))
    }).pipe(Effect.provide(StudioLock.layer)))

  it.effect("serialises bodies and releases the lock after a failure", () =>
    Effect.gen(function*() {
      const lock = yield* StudioLock
      const log = yield* Ref.make<ReadonlyArray<string>>([])
      const release = yield* Latch.make()
      const started = yield* Latch.make()

      const first = yield* lock.withLock(() =>
        Ref.update(log, (l) => [...l, "first:start"]).pipe(
          Effect.andThen(started.open),
          Effect.andThen(release.await),
          Effect.andThen(Ref.update(log, (l) => [...l, "first:end"])),
          Effect.andThen(Effect.fail("boom"))
        )
      ).pipe(Effect.forkChild)
      yield* started.await
      const second = yield* lock.withLock(() => Ref.update(log, (l) => [...l, "second"])).pipe(Effect.forkChild)
      yield* Effect.yieldNow
      assert.deepStrictEqual(yield* Ref.get(log), ["first:start"])

      yield* release.open
      const firstExit = yield* Fiber.await(first)
      assert.isTrue(Exit.isFailure(firstExit))
      yield* Fiber.join(second)
      assert.deepStrictEqual(yield* Ref.get(log), ["first:start", "first:end", "second"])
    }).pipe(Effect.provide(StudioLock.layer)))

  it.effect("waiting for the lock stays interruptible", () =>
    Effect.gen(function*() {
      const lock = yield* StudioLock
      const release = yield* Latch.make()
      const started = yield* Latch.make()
      const ran = yield* Ref.make(false)

      const holder = yield* lock.withLock(() =>
        started.open.pipe(Effect.andThen(release.await))
      ).pipe(Effect.forkChild)
      yield* started.await
      const waiter = yield* lock.withLock(() => Ref.set(ran, true)).pipe(Effect.forkChild)
      yield* Effect.yieldNow
      yield* Fiber.interrupt(waiter)

      yield* release.open
      yield* Fiber.join(holder)
      assert.isFalse(yield* Ref.get(ran))
    }).pipe(Effect.provide(StudioLock.layer)))
})

// A subscriber layer like part 4's: it subscribes while it is built and forks its consumer,
// which forwards every event to a queue the test reads.
class Received extends Context.Service<Received, Queue.Queue<BookingEvent>>()("test/Received") {}

const SubscriberLive = Layer.effect(
  Received,
  Effect.gen(function*() {
    const events = yield* BookingEvents
    const subscription = yield* events.subscribe
    const received = yield* Queue.unbounded<BookingEvent>()
    yield* PubSub.take(subscription).pipe(
      Effect.flatMap((event) => Queue.offer(received, event)),
      Effect.forever,
      Effect.forkScoped
    )
    return received
  })
).pipe(Layer.provide(CoreLive))

// The subscriber shares the app's bus because CoreLive is built once per app.
const AppWithSubscriber = Layer.mergeAll(ServerLive, SubscriberLive).pipe(
  Layer.provideMerge(NodeHttpServer.layerTest)
)

layer(AppWithSubscriber)("BookingEvents", (it) => {
  it.effect("a subscriber layer receives an event published right after startup", () =>
    Effect.gen(function*() {
      const lock = yield* StudioLock
      const events = yield* BookingEvents
      const received = yield* Received
      const booking = new Booking({
        id: BookingId.make("booking-event-test"),
        classId: ClassId.make("class-d1-1"),
        memberId: demoMembers.ada.id,
        bookedAt: yield* DateTime.now,
        source: "member",
        status: "booked",
        creditUse: { _tag: "Membership", membershipId: MembershipId.make("allow-all") }
      })

      yield* lock.withLock((held) => events.publish(held, new BookingConfirmed({ booking })))

      const event = yield* Queue.take(received)
      assert.strictEqual(event._tag, "BookingConfirmed")
      assert.strictEqual(event.booking.id, booking.id)
    }))

  it.effect("a booking over HTTP publishes BookingConfirmed", () =>
    Effect.gen(function*() {
      const client = yield* HttpApiClient.make(Api)
      const received = yield* Received
      const booking = yield* client.bookings.book({
        payload: { classId: ClassId.make("class-d2-1"), memberId: demoMembers.dara.id }
      })

      const event = yield* Queue.take(received)
      assert.strictEqual(event._tag, "BookingConfirmed")
      assert.strictEqual(event.booking.id, booking.id)
      assert.strictEqual(event.booking.source, "member")
    }))
})

// The test seam: AppLive with a substitute Entitlements that refuses every booking.
const RefuseAll = Layer.succeed(Entitlements)(Entitlements.of({
  use: (_held, memberId, classSession) => Effect.fail(new NoCredit({ memberId, classId: classSession.id })),
  restore: () => Effect.void,
  balance: (memberId) => Effect.succeed(new MemberBalance({ memberId, packCreditsLeft: 0 })),
  listBalances: Effect.succeed([])
}))

// The other two open requirements of AppLive, as inline test layers so this test doesn't
// depend on the placeholder files that parts 2 and 3 replace.
const PromoteNoOne = Layer.succeed(Promotion)(Promotion.of({
  onSpotFreed: () => Effect.succeed([])
}))

const DeclineAll = Layer.succeed(PaymentProvider)(PaymentProvider.of({
  charge: () => Effect.fail(new PaymentDeclined({ reason: "test provider declines every charge" }))
}))

const SeamLive = AppLive.pipe(
  Layer.provide(Layer.mergeAll(RefuseAll, PromoteNoOne, DeclineAll)),
  Layer.provideMerge(NodeHttpServer.layerTest)
)

layer(SeamLive)("AppLive test seam", (it) => {
  it.effect("boots with a substitute Entitlements; NoCredit is a 402 over HTTP", () =>
    Effect.gen(function*() {
      const client = yield* HttpApiClient.make(Api)
      const classes = yield* client.studio.listClasses()
      const target = classes.find((c) => c.spotsLeft > 0)
      assert.isDefined(target)

      const refused = yield* client.bookings.book({
        payload: { classId: target.id, memberId: demoMembers.ada.id }
      }).pipe(Effect.flip)
      assert.strictEqual(refused._tag, "NoCredit")

      const after = yield* client.studio.listClasses()
      assert.strictEqual(after.find((c) => c.id === target.id)?.spotsLeft, target.spotsLeft)
    }))
})
