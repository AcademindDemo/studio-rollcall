import { Context } from "effect"
import type { Effect } from "effect"
import type { Booking } from "../../domain/Booking.ts"
import type { ClassSession } from "../../domain/ClassSession.ts"
import type { Bookings } from "./Bookings.ts"
import type { LockHeld } from "./StudioLock.ts"

// Fills a freed spot from the waitlist. Bookings.cancel calls it inside its own lock, right
// after freeing the spot, and returns the waitlist bookings it made. It never fails: each
// `allocate` error is handled per waiting entry, as plan.md part 2 says for the first three.
//   NoCredit -> entry `skipped`, continue.  AlreadyBooked -> entry `promoted`, continue.
//   ClassFull -> stop, the class is full again.  MemberNotFound -> entry `skipped`, continue.
//   ClassNotFound, ClassStarted -> stop; nothing can be booked for this class.
// It needs Bookings (for `allocate`) at call time rather than at layer build, because Bookings
// itself depends on Promotion: the Bookings implementation provides itself, e.g.
// `promotion.onSpotFreed(held, session).pipe(Effect.provideService(Bookings, self))`.
export class Promotion extends Context.Service<Promotion, {
  onSpotFreed(held: LockHeld, classSession: ClassSession): Effect.Effect<ReadonlyArray<Booking>, never, Bookings>
}>()("rollcall/contracts/Promotion") {}
