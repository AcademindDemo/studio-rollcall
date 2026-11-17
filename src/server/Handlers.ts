import { Effect, Layer } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { Api } from "../api/Api.ts"
import { ScheduleHandlersLive } from "./schedule/ScheduleHandlers.ts"
import { BookingsHandlersLive } from "./booking/BookingsHandlers.ts"
import { BillingHandlersLive } from "./billing/Handlers.ts"
import { OutboxHandlersLive } from "./email/OutboxHandlers.ts"
import { WaitlistHandlersLive } from "./waitlist/WaitlistHandlers.ts"
import { StaffHandlersLive } from "./staff/StaffHandlers.ts"

const SystemHandlers = HttpApiBuilder.group(Api, "system", (handlers) =>
  Effect.succeed(handlers.handle("health", () => Effect.void)))

// Each part adds one line for its handler group.
export const HandlersLive = Layer.mergeAll(
  SystemHandlers,
  BillingHandlersLive,
  ScheduleHandlersLive,
  BookingsHandlersLive,
  OutboxHandlersLive,
  WaitlistHandlersLive,
  StaffHandlersLive
)
