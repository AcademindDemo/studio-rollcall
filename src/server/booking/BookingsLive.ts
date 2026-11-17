import { DateTime, Effect, Layer, Ref } from "effect"
import { BookedClass, Booking, BookingId } from "../../domain/Booking.ts"
import { ClassListing } from "../../domain/ClassSession.ts"
import type { ClassId, ClassSession } from "../../domain/ClassSession.ts"
import { AlreadyBooked, AlreadyCheckedIn, BookingNotActive, BookingNotFound, ClassFull, ClassStarted, NotYourBooking } from "../../domain/Errors.ts"
import { BookingCancelled, BookingConfirmed } from "../../domain/Events.ts"
import { BookingEvents } from "../contracts/BookingEvents.ts"
import { Bookings } from "../contracts/Bookings.ts"
import { Directory } from "../contracts/Directory.ts"
import { Entitlements } from "../contracts/Entitlements.ts"
import { Promotion } from "../contracts/Promotion.ts"
import { Schedule } from "../contracts/Schedule.ts"
import { StudioLock } from "../contracts/StudioLock.ts"
import { scheduleSeed } from "../seed/schedule.ts"

export const BookingsLive = Layer.effect(Bookings, Effect.gen(function*() {
  const schedule = yield* Schedule
  const directory = yield* Directory
  const lock = yield* StudioLock
  const entitlements = yield* Entitlements
  const events = yield* BookingEvents
  const promotion = yield* Promotion
  const now = yield* DateTime.now
  const seed = scheduleSeed(DateTime.add(DateTime.startOf(now, "day"), { days: 1 }))
  // Keep the class alongside each booking: cancel and reminder reads do not depend
  // on the rolling schedule still exposing that occurrence.
  interface BookingState {
    readonly bookings: ReadonlyArray<BookedClass>
    readonly holds: ReadonlyMap<ClassId, number>
  }
  const state = yield* Ref.make<BookingState>({
    bookings: seed.bookings.flatMap((booking) => seed.classes
      .filter((session) => session.id === booking.classId)
      .map((classSession) => new BookedClass({ booking, classSession }))),
    holds: new Map()
  })
  const getEntry = (bookingId: BookingId) => Effect.gen(function*() {
    const found = (yield* Ref.get(state)).bookings.find((b) => b.booking.id === bookingId)
    return found === undefined ? yield* new BookingNotFound({ bookingId }) : found
  })
  const get: Bookings["Service"]["get"] = (bookingId) => getEntry(bookingId).pipe(Effect.map((entry) => entry.booking))
  const listingFor = (session: ClassSession, snapshot: BookingState) => {
    const active = snapshot.bookings.filter((b) => b.booking.classId === session.id && b.booking.status === "booked").length
    const walkInHolds = snapshot.holds.get(session.id) ?? 0
    return new ClassListing({
      id: session.id, studioId: session.studioId, title: session.title, startsAt: session.startsAt,
      durationMinutes: session.durationMinutes, room: session.room, instructor: session.instructor, capacity: session.capacity,
      ...(session.weeklyClassId === undefined ? {} : { weeklyClassId: session.weeklyClassId }),
      walkInHolds, spotsLeft: session.capacity - active - walkInHolds
    })
  }
  const allocate: Bookings["Service"]["allocate"] = (held, classId, memberId, source) => Effect.gen(function*() {
    const session = yield* schedule.getClass(classId)
    const now = yield* DateTime.now
    if (session.startsAt.epochMilliseconds <= now.epochMilliseconds) return yield* new ClassStarted({ classId })
    yield* directory.getMember(memberId)
    const current = yield* Ref.get(state)
    if (current.bookings.some(({ booking: b }) => b.classId === classId && b.memberId === memberId && b.status === "booked")) {
      return yield* new AlreadyBooked({ classId, memberId })
    }
    if (listingFor(session, current).spotsLeft <= 0) return yield* new ClassFull({ classId })
    const creditUse = yield* entitlements.use(held, memberId, session)
    const booking = new Booking({ id: BookingId.make(`booking-${current.bookings.length + 1}`), classId, memberId, bookedAt: now, source, status: "booked", creditUse })
    yield* Ref.set(state, { ...current, bookings: [...current.bookings, new BookedClass({ booking, classSession: session })] })
    yield* events.publish(held, new BookingConfirmed({ booking }))
    return booking
  })
  const self: Bookings["Service"] = Bookings.of({
    get,
    allocate,
    book: (input) => lock.withLock((held) => allocate(held, input.classId, input.memberId, "member")),
    cancel: (input) => lock.withLock((held) => Effect.gen(function*() {
      const entry = yield* getEntry(input.bookingId)
      const booking = entry.booking
      if (booking.memberId !== input.memberId) return yield* new NotYourBooking(input)
      if (booking.status !== "booked") return yield* new BookingNotActive({ bookingId: input.bookingId })
      const session = entry.classSession
      const now = yield* DateTime.now
      const remaining = session.startsAt.epochMilliseconds - now.epochMilliseconds
      if (remaining <= 0) return yield* new ClassStarted({ classId: booking.classId })
      const creditReturned = remaining >= 12 * 60 * 60 * 1000
      if (creditReturned) yield* entitlements.restore(held, booking.creditUse)
      const cancelled = new Booking({
        id: booking.id, classId: booking.classId, memberId: booking.memberId, bookedAt: booking.bookedAt,
        source: booking.source, creditUse: booking.creditUse, status: "cancelled", cancelledAt: now,
        ...(booking.checkedInAt === undefined ? {} : { checkedInAt: booking.checkedInAt })
      })
      // Cancellation and its walk-in hold become visible in one snapshot.
      yield* Ref.update(state, (current) => ({
        bookings: current.bookings.map((b) => b.booking.id === booking.id
          ? new BookedClass({ booking: cancelled, classSession: b.classSession }) : b),
        holds: remaining <= 2 * 60 * 60 * 1000
          ? new Map(current.holds).set(session.id, (current.holds.get(session.id) ?? 0) + 1)
          : current.holds
      }))
      yield* events.publish(held, new BookingCancelled({ booking: cancelled, creditReturned }))
      yield* promotion.onSpotFreed(held, session).pipe(Effect.provideService(Bookings, self))
      return cancelled
    })),
    checkIn: (input) => lock.withLock(() => Effect.gen(function*() {
      const booking = yield* get(input.bookingId)
      if (booking.status !== "booked") return yield* new BookingNotActive(input)
      if (booking.checkedInAt !== undefined) return yield* new AlreadyCheckedIn(input)
      const checked = new Booking({
        id: booking.id, classId: booking.classId, memberId: booking.memberId, bookedAt: booking.bookedAt,
        source: booking.source, creditUse: booking.creditUse, status: booking.status, checkedInAt: yield* DateTime.now
      })
      yield* Ref.update(state, (current) => ({
        ...current, bookings: current.bookings.map((b) => b.booking.id === booking.id
          ? new BookedClass({ booking: checked, classSession: b.classSession }) : b)
      }))
      return checked
    })),
    roster: (classId) => schedule.getClass(classId).pipe(
      Effect.andThen(Ref.get(state)),
      Effect.map((snapshot) => snapshot.bookings.map((b) => b.booking).filter((b) => b.classId === classId)
        .sort((a, b) => a.bookedAt.epochMilliseconds - b.bookedAt.epochMilliseconds))
    ),
    forMember: (memberId) => directory.getMember(memberId).pipe(
      Effect.andThen(Ref.get(state)),
      Effect.map((snapshot) => snapshot.bookings.map((b) => b.booking).filter((b) => b.memberId === memberId))
    ),
    upcoming: (from, to) => Ref.get(state).pipe(Effect.map((snapshot) => snapshot.bookings.filter((b) =>
      b.booking.status === "booked" && b.classSession.startsAt.epochMilliseconds >= from.epochMilliseconds &&
      b.classSession.startsAt.epochMilliseconds < to.epochMilliseconds))),
    listing: (classId) => schedule.getClass(classId).pipe(
      Effect.flatMap((session) => Ref.get(state).pipe(Effect.map((snapshot) => listingFor(session, snapshot))))
    ),
    listWeek: schedule.listWeek.pipe(
      Effect.flatMap((week) => Ref.get(state).pipe(Effect.map((snapshot) => week.map((session) => listingFor(session, snapshot)))))
    )
  })
  return self
}))
