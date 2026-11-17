import { Effect, Layer, Ref } from "effect"
import { PaymentRef } from "../../domain/Billing.ts"
import { PaymentDeclined } from "../../domain/Errors.ts"
import { PaymentProvider } from "../contracts/PaymentProvider.ts"

// Fake cards only. The exact token "decline" always declines; every other nonempty token succeeds.
export const declineToken = "decline"
export const makeFake = Effect.gen(function*() {
  const sequence = yield* Ref.make(0)
  return PaymentProvider.of({
    charge: (token) => token === declineToken
      ? Effect.fail(new PaymentDeclined({ reason: "Fake card declined" }))
      : Ref.updateAndGet(sequence, (n) => n + 1).pipe(Effect.map((n) => PaymentRef.make(`fake-payment-${n}`)))
  })
})
export const layerFake = Layer.effect(PaymentProvider, makeFake)
