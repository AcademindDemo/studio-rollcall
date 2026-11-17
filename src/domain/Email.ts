import { Schema } from "effect"
import { BookingId } from "./Booking.ts"

export const OutboxEmailId = Schema.NonEmptyString.pipe(Schema.brand("OutboxEmailId"))
export type OutboxEmailId = typeof OutboxEmailId.Type

export const EmailKind = Schema.Literals(["BookingConfirmed", "WaitlistPromoted", "ClassReminder"])
export type EmailKind = typeof EmailKind.Type

// An email written to the local outbox. Nothing is sent.
export class OutboxEmail extends Schema.Class<OutboxEmail>("OutboxEmail")({
  id: OutboxEmailId,
  kind: EmailKind,
  to: Schema.NonEmptyString,
  subject: Schema.NonEmptyString,
  body: Schema.String,
  bookingId: BookingId,
  createdAt: Schema.DateTimeUtc
}) {}

// Every field narrows the list; an empty filter lists everything.
export const OutboxFilter = Schema.Struct({
  kind: Schema.optionalKey(EmailKind),
  to: Schema.optionalKey(Schema.NonEmptyString),
  bookingId: Schema.optionalKey(BookingId)
})
export type OutboxFilter = typeof OutboxFilter.Type
