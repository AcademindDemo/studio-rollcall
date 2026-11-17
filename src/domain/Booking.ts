import { Schema } from "effect"
import { ClassId } from "./ClassSession.ts"
import { MemberId } from "./Member.ts"

export const BookingId = Schema.NonEmptyString.pipe(Schema.brand("BookingId"))
export type BookingId = typeof BookingId.Type

export class Booking extends Schema.Class<Booking>("Booking")({
  id: BookingId,
  classId: ClassId,
  memberId: MemberId,
  bookedAt: Schema.DateTimeUtc
}) {}

// Request payloads are plain structs so clients can send object literals.
export const BookClassInput = Schema.Struct({
  classId: ClassId,
  memberId: MemberId
})
export type BookClassInput = typeof BookClassInput.Type
