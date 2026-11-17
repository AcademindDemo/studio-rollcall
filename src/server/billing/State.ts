import { Context, DateTime, Effect, Layer, Ref } from "effect"
import type { ClassPack, Membership, Purchase } from "../../domain/Billing.ts"
import { billingSeed } from "../seed/billing.ts"

export interface BillingData {
  readonly packs: ReadonlyArray<ClassPack>
  readonly memberships: ReadonlyArray<Membership>
  readonly purchases: ReadonlyArray<Purchase>
}

export class BillingState extends Context.Service<BillingState, Ref.Ref<BillingData>>() (
  "rollcall/billing/State"
) {}

// Shared by the billing and entitlement layers, memoized once per app.
export const StateLive = Layer.effect(BillingState, Effect.gen(function*() {
  const now = yield* DateTime.now
  return yield* Ref.make<BillingData>({ ...billingSeed(now), purchases: [] })
}))
