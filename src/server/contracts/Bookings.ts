import { Context } from "effect"
import type { DateTime, Effect } from "effect"
import type {
  BookClassInput,
  BookedClass,
  Booking,
  BookingId,
  BookingSource,
  CancelBookingInput,
  CheckInInput
} from "../../domain/Booking.ts"
import type { ClassId, ClassListing } from "../../domain/ClassSession.ts"
import type {
  AlreadyBooked,
  AlreadyCheckedIn,
  BookingNotActive,
  BookingNotFound,
  ClassFull,
  ClassNotFound,
  ClassStarted,
  MemberNotFound,
  NoCredit,
  NotYourBooking
} from "../../domain/Errors.ts"
import type { MemberId } from "../../domain/Member.ts"
import type { LockHeld } from "./StudioLock.ts"

export class Bookings extends Context.Service<Bookings, {
  // Commands: each takes StudioLock.
  book(
    input: BookClassInput
  ): Effect.Effect<Booking, ClassNotFound | MemberNotFound | ClassStarted | AlreadyBooked | ClassFull | NoCredit>
  // Only `booked -> cancelled`. Restores the credit 12 h or more before start, publishes
  // BookingCancelled, then calls Promotion.onSpotFreed in the same lock.
  cancel(input: CancelBookingInput): Effect.Effect<Booking, BookingNotFound | NotYourBooking | BookingNotActive | ClassStarted>
  checkIn(input: CheckInInput): Effect.Effect<Booking, BookingNotFound | BookingNotActive | AlreadyCheckedIn>

  // Step inside the caller's lock: the checks and writes of `book` for a given source, so it
  // fails with the same errors as `book`. This is what promotion uses.
  allocate(
    held: LockHeld,
    classId: ClassId,
    memberId: MemberId,
    source: BookingSource
  ): Effect.Effect<Booking, ClassNotFound | MemberNotFound | ClassStarted | AlreadyBooked | ClassFull | NoCredit>

  // Reads.
  get(bookingId: BookingId): Effect.Effect<Booking, BookingNotFound>
  // Every booking of the class, cancelled ones included, in `bookedAt` order.
  roster(classId: ClassId): Effect.Effect<ReadonlyArray<Booking>, ClassNotFound>
  forMember(memberId: MemberId): Effect.Effect<ReadonlyArray<Booking>, MemberNotFound>
  // `booked` bookings whose class starts in [from, to), with their class.
  upcoming(from: DateTime.Utc, to: DateTime.Utc): Effect.Effect<ReadonlyArray<BookedClass>>
  // A class with its walk-in holds and spots left.
  listing(classId: ClassId): Effect.Effect<ClassListing, ClassNotFound>
  // The schedule's week (Schedule.listWeek) with walk-in holds and spots left. Serves GET /classes.
  readonly listWeek: Effect.Effect<ReadonlyArray<ClassListing>>
}>()("rollcall/contracts/Bookings") {}
