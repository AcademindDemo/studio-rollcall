import { Effect } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { Api } from "../../api/Api.ts"
import { Bookings } from "../contracts/Bookings.ts"

export const BookingsHandlersLive = HttpApiBuilder.group(Api, "bookings", Effect.fn(function*(handlers) {
  const bookings = yield* Bookings
  return handlers
    .handle("book", ({ payload }) => bookings.book(payload))
    .handle("cancel", ({ params, payload }) => bookings.cancel({ bookingId: params.id, memberId: payload.memberId }))
    .handle("forMember", ({ params }) => bookings.forMember(params.id))
}))
