import { Layer } from "effect"
import { HttpRouter } from "effect/http"
import { HttpApiBuilder } from "effect/http-api"
import { Api } from "../api/Api.ts"
import { CoreLive } from "./core/CoreLive.ts"
import { HandlersLive } from "./Handlers.ts"
import { layerLive as BillingLive } from "./billing/Billing.ts"
import { layerLive as EntitlementsLive } from "./billing/Entitlements.ts"
import { layerFake } from "./billing/PaymentProvider.ts"
import { OutboxLive } from "./email/OutboxLive.ts"
import { ScheduleLive } from "./schedule/ScheduleLive.ts"
import { BookingsLive } from "./booking/BookingsLive.ts"
import { PromotionLive } from "./waitlist/PromotionLive.ts"
import { WaitlistLive } from "./waitlist/WaitlistLive.ts"
import { StaffPageLive } from "./staff/StaffPage.ts"

const ApiLive = HttpApiBuilder.layer(Api, { openapiPath: "/openapi.json" }).pipe(Layer.provide(HandlersLive))
  .pipe(Layer.merge(StaffPageLive))

// The whole app, with Entitlements, PaymentProvider and Promotion left open: the test seam.
// Services are listed most dependent first; each line may use the services on the lines below it.
// Every service is merged into the output, so a test can use them directly.
export const AppLive = HttpRouter.serve(ApiLive).pipe(
  Layer.provideMerge(OutboxLive),
  Layer.provideMerge(WaitlistLive),
  Layer.provideMerge(BookingsLive),
  Layer.provideMerge(ScheduleLive),
  Layer.provideMerge(BillingLive),
  Layer.provideMerge(CoreLive)
)

// AppLive with the current real or placeholder layers for the test seam.
// Needs an HttpServer (see src/main.ts and the e2e tests).
export const ServerLive = AppLive.pipe(
  Layer.provideMerge(Layer.mergeAll(EntitlementsLive, layerFake)),
  Layer.provideMerge(PromotionLive)
)
