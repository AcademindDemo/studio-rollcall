import { Context, Effect, Layer, PubSub } from "effect"
import type { Scope } from "effect"
import type { BookingEvent } from "../../domain/Events.ts"
import type { LockHeld } from "./StudioLock.ts"

// In-process bus for booking events, an unbounded PubSub.
// `publish` runs inside the command's lock, so a committed change always has its event.
// `subscribe` is scoped: a subscriber layer subscribes while it is being built, which is
// before the server serves, so it sees every event.
export class BookingEvents extends Context.Service<BookingEvents, {
  publish(held: LockHeld, event: BookingEvent): Effect.Effect<void>
  readonly subscribe: Effect.Effect<PubSub.Subscription<BookingEvent>, never, Scope.Scope>
}>()("rollcall/contracts/BookingEvents") {
  static readonly layer = Layer.effect(
    BookingEvents,
    Effect.gen(function*() {
      const pubsub = yield* Effect.acquireRelease(PubSub.unbounded<BookingEvent>(), PubSub.shutdown)
      return BookingEvents.of({
        publish: (_held, event) => PubSub.publish(pubsub, event).pipe(Effect.asVoid),
        subscribe: PubSub.subscribe(pubsub)
      })
    })
  )
}
