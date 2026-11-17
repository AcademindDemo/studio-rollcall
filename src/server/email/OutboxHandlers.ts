import { Effect, Layer } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { Api } from "../../api/Api.ts"
import type { OutboxFilter } from "../../domain/Email.ts"
import { Outbox } from "../contracts/Outbox.ts"
import { OutboxLive } from "./OutboxLive.ts"

// Absent query fields stay absent: exactOptionalPropertyTypes rejects an explicit undefined.
const filterOf = (query: {
  readonly kind?: OutboxFilter["kind"]
  readonly to?: OutboxFilter["to"]
  readonly bookingId?: OutboxFilter["bookingId"]
}): OutboxFilter => ({
  ...(query.kind === undefined ? {} : { kind: query.kind }),
  ...(query.to === undefined ? {} : { to: query.to }),
  ...(query.bookingId === undefined ? {} : { bookingId: query.bookingId })
})

export const OutboxHandlersLive = HttpApiBuilder.group(
  Api,
  "outbox",
  Effect.fn("OutboxHandlers")(function*(handlers) {
    const outbox = yield* Outbox
    return handlers.handle("list", ({ query }) => outbox.list(filterOf(query)))
  })
).pipe(
  // Same OutboxLive reference as AppLive, so the build memoizes one mailbox.
  // HandlersLive is also composed without a separate Outbox provide.
  Layer.provide(OutboxLive)
)
