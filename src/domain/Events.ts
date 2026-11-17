import { Schema } from "effect"
import { Booking } from "./Booking.ts"

// Published inside the command's StudioLock, so every committed change has its event.
// Whether a confirmation came from the member or the waitlist is `booking.source`.
export class BookingConfirmed extends Schema.TaggedClass<BookingConfirmed>()("BookingConfirmed", {
  booking: Booking
}) {}

export class BookingCancelled extends Schema.TaggedClass<BookingCancelled>()("BookingCancelled", {
  booking: Booking,
  creditReturned: Schema.Boolean
}) {}

export const BookingEvent = Schema.Union([BookingConfirmed, BookingCancelled])
export type BookingEvent = typeof BookingEvent.Type
