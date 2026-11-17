import { DateTime, Effect, Layer, Ref, Result } from "effect"
import type { Booking } from "../../domain/Booking.ts"
import { WaitlistEntry } from "../../domain/Waitlist.ts"
import type { WaitlistEntryId } from "../../domain/Waitlist.ts"
import { Bookings } from "../contracts/Bookings.ts"
import { Promotion } from "../contracts/Promotion.ts"
import { byJoinedAt, EntriesLive, WaitlistEntries } from "./Entries.ts"

const twoHoursMs = 2 * 60 * 60 * 1000

// Bookings.cancel calls this inside its lock, after the spot is free (and after a
// walk-in hold is recorded when the cancel is 2 h or less before start).
export const PromotionLive = Layer.effect(Promotion, Effect.gen(function*() {
  const entries = yield* WaitlistEntries
  const setStatus = (id: WaitlistEntryId, status: "promoted" | "skipped") => Ref.update(entries, (current) =>
    current.map((entry) => entry.id === id
      ? new WaitlistEntry({ id: entry.id, classId: entry.classId, memberId: entry.memberId, joinedAt: entry.joinedAt, status })
      : entry))
  return Promotion.of({
    onSpotFreed: (held, session) => Effect.gen(function*() {
      const bookings = yield* Bookings
      const waiting = byJoinedAt((yield* Ref.get(entries)).filter((entry) => entry.classId === session.id && entry.status === "waiting"))
      const made: Array<Booking> = []
      for (const entry of waiting) {
        // The lock does not freeze time. Read the cutoff before each allocate so a skip
        // that crosses two hours does not book the next waiter. Part 1 records the walk-in
        // hold from the time of the cancel itself.
        const now = yield* DateTime.now
        if (session.startsAt.epochMilliseconds - now.epochMilliseconds <= twoHoursMs) return made
        const result = yield* bookings.allocate(held, session.id, entry.memberId, "waitlist").pipe(Effect.result)
        if (Result.isSuccess(result)) {
          yield* setStatus(entry.id, "promoted")
          made.push(result.success)
          continue
        }
        // NoCredit and MemberNotFound skip this member. AlreadyBooked means they
        // already have the class, so the entry is promoted and the spot stays open.
        // ClassFull, ClassNotFound and ClassStarted stop the walk; that entry stays waiting.
        const error = result.failure
        switch (error._tag) {
          case "NoCredit":
          case "MemberNotFound":
            yield* setStatus(entry.id, "skipped")
            break
          case "AlreadyBooked":
            yield* setStatus(entry.id, "promoted")
            break
          case "ClassFull":
          case "ClassNotFound":
          case "ClassStarted":
            return made
          default: {
            const unexpected: never = error
            return unexpected
          }
        }
      }
      return made
    })
  })
})).pipe(Layer.provide(EntriesLive))
