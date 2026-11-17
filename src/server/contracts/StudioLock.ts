import { Context, Effect, Layer, Semaphore } from "effect"

const lockHeld: unique symbol = Symbol("rollcall/LockHeld")

// Proof that the caller is inside StudioLock.withLock. Only this module can create one,
// so a step that takes a LockHeld can't be called outside the lock.
export interface LockHeld {
  readonly [lockHeld]: true
}

// One lock for every write in the studio. The body runs uninterruptibly: once it has the
// lock it runs to the end, so a command never stops between two of its writes.
// Steps that take a LockHeld never call withLock themselves; the lock is not re-entrant.
export class StudioLock extends Context.Service<StudioLock, {
  withLock<A, E, R>(body: (held: LockHeld) => Effect.Effect<A, E, R>): Effect.Effect<A, E, R>
}>()("rollcall/contracts/StudioLock") {
  static readonly layer = Layer.effect(
    StudioLock,
    Effect.gen(function*() {
      const semaphore = yield* Semaphore.make(1)
      const held: LockHeld = { [lockHeld]: true }
      return StudioLock.of({
        // Waiting for the lock stays interruptible; the body does not.
        withLock: (body) => Semaphore.withPermit(semaphore)(Effect.uninterruptible(Effect.suspend(() => body(held))))
      })
    })
  )
}
