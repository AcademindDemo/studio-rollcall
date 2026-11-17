// Development and test view of the local outbox. Nothing is sent.
import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup } from "effect/http-api"
import { BookingId } from "../domain/Booking.ts"
import { EmailKind, OutboxEmail } from "../domain/Email.ts"

export class OutboxApi extends HttpApiGroup.make("outbox").add(
  HttpApiEndpoint.get("list", "/outbox", {
    query: {
      kind: Schema.optional(EmailKind),
      to: Schema.optional(Schema.NonEmptyString),
      bookingId: Schema.optional(BookingId)
    },
    success: Schema.Array(OutboxEmail)
  })
) {}
