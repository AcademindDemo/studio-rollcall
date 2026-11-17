import { Context, DateTime, Effect, Layer, SynchronizedRef } from "effect"
import { Booking, BookingId } from "../domain/Booking.ts"
import type { BookClassInput } from "../domain/Booking.ts"
import { ClassListing } from "../domain/ClassSession.ts"
import { AlreadyBooked, ClassFull, ClassNotFound, MemberNotFound } from "../domain/Errors.ts"
import type { Studio } from "../domain/Studio.ts"
import { seed } from "./Seed.ts"
import type { SeedData } from "./Seed.ts"

// In-memory state for one running app. Each process (and so each agent's port) gets its own copy.
export class Store extends Context.Service<Store, {
  readonly studio: Effect.Effect<Studio>
  readonly listClasses: Effect.Effect<ReadonlyArray<ClassListing>>
  book(input: BookClassInput): Effect.Effect<Booking, ClassNotFound | MemberNotFound | ClassFull | AlreadyBooked>
}>()("rollcall/Store") {
  static readonly make = Effect.fn("Store.make")(function*(data: SeedData) {
    const state = yield* SynchronizedRef.make(data)

    const listClasses = SynchronizedRef.get(state).pipe(
      Effect.map(({ bookings, classes }) =>
        classes.map((session) =>
          new ClassListing({
            id: session.id,
            studioId: session.studioId,
            title: session.title,
            startsAt: session.startsAt,
            durationMinutes: session.durationMinutes,
            room: session.room,
            instructor: session.instructor,
            capacity: session.capacity,
            spotsLeft: session.capacity - bookings.filter((b) => b.classId === session.id).length
          })
        )
      )
    )

    const book = Effect.fn("Store.book")(function*(input: BookClassInput) {
      const now = yield* DateTime.now
      return yield* SynchronizedRef.modifyEffect(state, Effect.fnUntraced(function*(current) {
        const session = current.classes.find((c) => c.id === input.classId)
        if (session === undefined) {
          return yield* new ClassNotFound({ classId: input.classId })
        }
        if (!current.members.some((m) => m.id === input.memberId)) {
          return yield* new MemberNotFound({ memberId: input.memberId })
        }
        const booked = current.bookings.filter((b) => b.classId === session.id)
        if (booked.some((b) => b.memberId === input.memberId)) {
          return yield* new AlreadyBooked({ classId: session.id, memberId: input.memberId })
        }
        if (booked.length >= session.capacity) {
          return yield* new ClassFull({ classId: session.id })
        }
        const booking = new Booking({
          id: BookingId.make(`booking-${current.bookings.length + 1}`),
          classId: session.id,
          memberId: input.memberId,
          bookedAt: now
        })
        return [booking, { ...current, bookings: [...current.bookings, booking] }] as const
      }))
    })

    return Store.of({ studio: Effect.succeed(data.studio), listClasses, book })
  })

  // Seeds a week of demo classes starting tomorrow (UTC).
  static readonly layerDemo = Layer.effect(
    Store,
    Effect.gen(function*() {
      const now = yield* DateTime.now
      const weekStart = DateTime.add(DateTime.startOf(now, "day"), { days: 1 })
      return yield* Store.make(seed(weekStart))
    })
  )
}
