import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"
import { BookClassInput, Booking, BookingId } from "../domain/Booking.ts"
import { AlreadyBooked, BookingNotActive, BookingNotFound, ClassFull, ClassNotFound, ClassStarted, MemberNotFound, NoCredit, NotYourBooking } from "../domain/Errors.ts"
import { MemberId } from "../domain/Member.ts"

export class BookingsApi extends HttpApiGroup.make("bookings").add(
  HttpApiEndpoint.post("book", "/bookings", {
    payload: BookClassInput,
    success: Booking.pipe(HttpApiSchema.status(201)),
    error: [ClassNotFound, MemberNotFound, ClassStarted, ClassFull, AlreadyBooked, NoCredit]
  }),
  HttpApiEndpoint.post("cancel", "/bookings/:id/cancel", {
    params: { id: BookingId }, payload: Schema.Struct({ memberId: MemberId }), success: Booking,
    error: [BookingNotFound, NotYourBooking, BookingNotActive, ClassStarted]
  }),
  HttpApiEndpoint.get("forMember", "/members/:id/bookings", {
    params: { id: MemberId }, success: Schema.Array(Booking), error: MemberNotFound
  })
) {}
