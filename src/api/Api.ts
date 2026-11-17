// The HTTP contract, shared by the server and typed clients. Keep server code out of src/api.
// Each part adds one `.add(...)` line for its group.
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"
import { ScheduleApi } from "./ScheduleApi.ts"
import { BookingsApi } from "./BookingsApi.ts"
import { BillingApi } from "./BillingApi.ts"
import { OutboxApi } from "./OutboxApi.ts"
import { WaitlistApi } from "./WaitlistApi.ts"
import { StaffApi } from "./StaffApi.ts"

export class SystemApi extends HttpApiGroup.make("system", { topLevel: true }).add(
  HttpApiEndpoint.get("health", "/health", { success: HttpApiSchema.NoContent })
) {}

export class Api extends HttpApi.make("studio-rollcall")
  .add(SystemApi)
  .add(ScheduleApi)
  .add(BookingsApi)
  .add(BillingApi)
  .add(OutboxApi)
  .add(WaitlistApi)
  .add(StaffApi)
{}
