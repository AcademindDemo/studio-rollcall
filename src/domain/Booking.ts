import { Schema } from "effect"
import { ClassPackId, MembershipId } from "./Billing.ts"
import { ClassId, ClassSession } from "./ClassSession.ts"
import { MemberId } from "./Member.ts"

export const BookingId = Schema.NonEmptyString.pipe(Schema.brand("BookingId"))
export type BookingId = typeof BookingId.Type

// What paid for a booking, so a cancel can give it back.
export const CreditUse = Schema.TaggedUnion({
  PackCredit: { packId: ClassPackId },
  Membership: { membershipId: MembershipId }
})
export type CreditUse = typeof CreditUse.Type

export const BookingSource = Schema.Literals(["member", "waitlist"])
export type BookingSource = typeof BookingSource.Type

export const BookingStatus = Schema.Literals(["booked", "cancelled"])
export type BookingStatus = typeof BookingStatus.Type

export class Booking extends Schema.Class<Booking>("Booking")({
  id: BookingId,
  classId: ClassId,
  memberId: MemberId,
  bookedAt: Schema.DateTimeUtc,
  source: BookingSource,
  status: BookingStatus,
  cancelledAt: Schema.optionalKey(Schema.DateTimeUtc),
  creditUse: CreditUse,
  checkedInAt: Schema.optionalKey(Schema.DateTimeUtc)
}) {}

// A booking together with its class, for reads that need the start time (reminders, rosters).
export class BookedClass extends Schema.Class<BookedClass>("BookedClass")({
  booking: Booking,
  classSession: ClassSession
}) {}

// Request payloads are plain structs so clients can send object literals.
export const BookClassInput = Schema.Struct({
  classId: ClassId,
  memberId: MemberId
})
export type BookClassInput = typeof BookClassInput.Type

export const CancelBookingInput = Schema.Struct({
  bookingId: BookingId,
  memberId: MemberId
})
export type CancelBookingInput = typeof CancelBookingInput.Type

export const CheckInInput = Schema.Struct({
  bookingId: BookingId
})
export type CheckInInput = typeof CheckInInput.Type
