import { Effect } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { Api } from "../../api/Api.ts"
import { Bookings } from "../contracts/Bookings.ts"
import { Directory } from "../contracts/Directory.ts"

export const ScheduleHandlersLive = HttpApiBuilder.group(Api, "studio", Effect.fn(function*(handlers) {
  const directory = yield* Directory
  const bookings = yield* Bookings
  return handlers.handle("get", () => directory.studio).handle("listClasses", () => bookings.listWeek)
}))
