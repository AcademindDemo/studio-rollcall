import { Effect, Layer } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { Api } from "../../api/Api.ts"
import { Billing } from "../contracts/Billing.ts"
import { Entitlements } from "../contracts/Entitlements.ts"
import { layerLive } from "./Billing.ts"

export const BillingHandlersLive = HttpApiBuilder.group(Api, "billing", Effect.fn(function*(handlers) {
  const billing = yield* Billing
  const entitlements = yield* Entitlements
  return handlers.handle("products", () => billing.products)
    .handle("purchase", ({ payload }) => billing.purchase(payload))
    .handle("balance", ({ params }) => entitlements.balance(params.id))
})).pipe(Layer.provide(layerLive))
