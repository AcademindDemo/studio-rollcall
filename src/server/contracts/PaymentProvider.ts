import { Context } from "effect"
import type { Effect } from "effect"
import type { CardToken, PaymentRef } from "../../domain/Billing.ts"
import type { PaymentDeclined } from "../../domain/Errors.ts"

// In-process fake only: no real network calls.
export class PaymentProvider extends Context.Service<PaymentProvider, {
  charge(cardToken: CardToken, amountCents: number): Effect.Effect<PaymentRef, PaymentDeclined>
}>()("rollcall/contracts/PaymentProvider") {}
