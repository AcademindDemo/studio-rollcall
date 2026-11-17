import { DateTime, Effect, Layer, Ref } from "effect"
import { AlreadyBooked, AlreadyWaitlisted, ClassNotFull, ClassStarted, NotOnWaitlist } from "../../domain/Errors.ts"
import { WaitlistEntry, WaitlistEntryId } from "../../domain/Waitlist.ts"
import { Bookings } from "../contracts/Bookings.ts"
import { Directory } from "../contracts/Directory.ts"
import { StudioLock } from "../contracts/StudioLock.ts"
import { Waitlist } from "../contracts/Waitlist.ts"
import { byJoinedAt, EntriesLive, WaitlistEntries } from "./Entries.ts"

const withStatus = (entry: WaitlistEntry, status: WaitlistEntry["status"]) => new WaitlistEntry({
  id: entry.id, classId: entry.classId, memberId: entry.memberId, joinedAt: entry.joinedAt, status
})

export const WaitlistLive = Layer.effect(Waitlist, Effect.gen(function*() {
  const entries = yield* WaitlistEntries
  const lock = yield* StudioLock
  const directory = yield* Directory
  const bookings = yield* Bookings
  const self: Waitlist["Service"] = {
    join: (input) => lock.withLock(() => Effect.gen(function*() {
      // Checks first, then the one write. Joining holds no credit.
      const session = yield* bookings.listing(input.classId)
      const now = yield* DateTime.now
      if (session.startsAt.epochMilliseconds <= now.epochMilliseconds) return yield* new ClassStarted({ classId: input.classId })
      yield* directory.getMember(input.memberId)
      if (session.spotsLeft > 0) return yield* new ClassNotFull({ classId: input.classId })
      const roster = yield* bookings.roster(input.classId)
      if (roster.some((booking) => booking.memberId === input.memberId && booking.status === "booked")) {
        return yield* new AlreadyBooked({ classId: input.classId, memberId: input.memberId })
      }
      const current = yield* Ref.get(entries)
      if (current.some((entry) => entry.classId === input.classId && entry.memberId === input.memberId && entry.status === "waiting")) {
        return yield* new AlreadyWaitlisted({ classId: input.classId, memberId: input.memberId })
      }
      const entry = new WaitlistEntry({
        id: WaitlistEntryId.make(`waitlist-${current.length + 1}`),
        classId: input.classId, memberId: input.memberId, joinedAt: now, status: "waiting"
      })
      yield* Ref.set(entries, [...current, entry])
      return entry
    })),
    leave: (input) => lock.withLock(() => Effect.gen(function*() {
      const current = yield* Ref.get(entries)
      const entry = current.find((candidate) =>
        candidate.classId === input.classId && candidate.memberId === input.memberId && candidate.status === "waiting")
      if (entry === undefined) return yield* new NotOnWaitlist(input)
      const left = withStatus(entry, "left")
      yield* Ref.set(entries, current.map((candidate) => candidate.id === entry.id ? left : candidate))
      return left
    })),
    forClass: (classId) => bookings.listing(classId).pipe(
      Effect.andThen(Ref.get(entries)),
      Effect.map((current) => byJoinedAt(current.filter((entry) => entry.classId === classId)))
    ),
    forMember: (memberId) => directory.getMember(memberId).pipe(
      Effect.andThen(Ref.get(entries)),
      Effect.map((current) => byJoinedAt(current.filter((entry) => entry.memberId === memberId)))
    )
  }
  return self
})).pipe(Layer.provide(EntriesLive))
