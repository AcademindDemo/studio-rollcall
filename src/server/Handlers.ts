import { Effect, Layer } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { Api } from "../api/Api.ts"
import { Store } from "./Store.ts"

const SystemHandlers = HttpApiBuilder.group(Api, "system", (handlers) =>
  Effect.succeed(handlers.handle("health", () => Effect.void)))

const StudioHandlers = HttpApiBuilder.group(
  Api,
  "studio",
  Effect.fn(function*(handlers) {
    const store = yield* Store
    return handlers
      .handle("get", () => store.studio)
      .handle("listClasses", () => store.listClasses)
  })
)

const BookingsHandlers = HttpApiBuilder.group(
  Api,
  "bookings",
  Effect.fn(function*(handlers) {
    const store = yield* Store
    return handlers.handle("book", ({ payload }) => store.book(payload))
  })
)

export const HandlersLive = Layer.mergeAll(SystemHandlers, StudioHandlers, BookingsHandlers)
