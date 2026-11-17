import { DateTime, Effect, Layer, Option, Ref, Schedule, Semaphore } from "effect"
import { ClassPack, ClassPackId, Membership, MembershipId, Purchase, PurchaseId } from "../../domain/Billing.ts"
import type { PurchaseInput } from "../../domain/Billing.ts"
import { AlreadyMember, ProductNotFound } from "../../domain/Errors.ts"
import { Billing } from "../contracts/Billing.ts"
import { Directory } from "../contracts/Directory.ts"
import { PaymentProvider } from "../contracts/PaymentProvider.ts"
import { StudioLock } from "../contracts/StudioLock.ts"
import { CoreLive } from "../core/CoreLive.ts"
import { products } from "../seed/billing.ts"
import { makeFake } from "./PaymentProvider.ts"
import { BillingState, StateLive } from "./State.ts"

export const layerLive = Layer.effect(Billing, Effect.gen(function*() {
  const state = yield* BillingState
  const directory = yield* Directory
  // Older AppLive consumers need only substitute Entitlements; a supplied provider still wins.
  const payments = yield* Effect.serviceOption(PaymentProvider).pipe(Effect.flatMap(Option.match({
    onNone: () => makeFake, onSome: Effect.succeed
  })))
  const lock = yield* StudioLock
  const paymentLock = yield* Semaphore.make(1)
  const purchase = Effect.fn("Billing.purchase")(function*(input: PurchaseInput) {
    yield* directory.getMember(input.memberId)
    const product = products.find((p) => p.id === input.productId)
    if (product === undefined) return yield* new ProductNotFound({ productId: input.productId })
    if (input.productId === "monthly") {
      yield* lock.withLock(() => Effect.gen(function*() {
        const now = yield* DateTime.now
        const data = yield* Ref.get(state)
        if (data.memberships.some((m) => m.memberId === input.memberId && DateTime.isGreaterThan(m.endsAt, now))) {
          return yield* new AlreadyMember({ memberId: input.memberId })
        }
      }))
    }
    // Recheck monthly eligibility at commit: another request may purchase after this preflight.
    // No interruption between a successful fake charge and the atomic commit.
    return yield* Effect.uninterruptible(Effect.gen(function*() {
      const paymentRef = yield* payments.charge(input.cardToken, product.priceCents)
      return yield* lock.withLock(() => Effect.gen(function*() {
        const now = yield* DateTime.now
        const data = yield* Ref.get(state)
        if (input.productId === "monthly" && data.memberships.some((m) => m.memberId === input.memberId && DateTime.isGreaterThan(m.endsAt, now))) {
          return yield* new AlreadyMember({ memberId: input.memberId })
        }
        const id = `purchase-${data.purchases.length + 1}`
        const record = new Purchase({ id: PurchaseId.make(id), memberId: input.memberId, productId: input.productId,
          amountCents: product.priceCents, paymentRef, at: now, reason: "purchase" })
        const next = input.productId === "monthly"
          ? { ...data, memberships: [...data.memberships.map((m) => m.memberId === input.memberId ? new Membership({ id: m.id, memberId: m.memberId, startsAt: m.startsAt, endsAt: m.endsAt, cardToken: m.cardToken, renewal: "failed" }) : m),
            new Membership({ id: MembershipId.make(id), memberId: input.memberId, startsAt: now,
              endsAt: DateTime.add(now, { days: 30 }), cardToken: input.cardToken, renewal: "active" })] }
          : { ...data, packs: [...data.packs, new ClassPack({ id: ClassPackId.make(id), memberId: input.memberId,
            size: input.productId === "pack-5" ? 5 : 10, remaining: input.productId === "pack-5" ? 5 : 10,
            purchasedAt: now, expiresAt: DateTime.add(now, { months: 3 }) })] }
        yield* Ref.set(state, { ...next, purchases: [...data.purchases, record] })
        return record
      }))
    }))
  })
  // Serialize billing payment operations without holding StudioLock during a provider charge.
  const renewDue = Semaphore.withPermit(paymentLock)(Effect.gen(function*() {
    const due = yield* lock.withLock(() => Effect.gen(function*() {
      const now = yield* DateTime.now
      const snapshot = yield* Ref.get(state)
      return snapshot.memberships.filter((m) => m.renewal === "active" && DateTime.isLessThanOrEqualTo(m.endsAt, now))
    }))
    const records: Array<Purchase> = []
    for (const membership of due) {
      const record = yield* Effect.uninterruptible(Effect.gen(function*() {
        const result = yield* payments.charge(membership.cardToken, 8900).pipe(Effect.result)
        return yield* lock.withLock(() => Effect.gen(function*() {
          const current = yield* Ref.get(state)
          const live = current.memberships.find((m) => m.id === membership.id)
          if (live === undefined || live.renewal !== "active" || !DateTime.Equivalence(live.endsAt, membership.endsAt)) return undefined
          const at = yield* DateTime.now
          if (result._tag === "Failure") {
            yield* Ref.set(state, { ...current, memberships: current.memberships.map((m) => m.id === live.id ? new Membership({ id: m.id, memberId: m.memberId, startsAt: m.startsAt, endsAt: m.endsAt, cardToken: m.cardToken, renewal: "failed" }) : m) })
            return undefined
          }
          const renewal = new Purchase({ id: PurchaseId.make(`purchase-${current.purchases.length + 1}`), memberId: live.memberId,
            productId: "monthly", amountCents: 8900, paymentRef: result.success, at, reason: "renewal" })
          yield* Ref.set(state, { ...current,
            memberships: current.memberships.map((m) => m.id === live.id ? new Membership({ id: m.id, memberId: m.memberId, startsAt: m.startsAt, cardToken: m.cardToken, renewal: m.renewal, endsAt: DateTime.add(m.endsAt, { days: 30 }) }) : m),
            purchases: [...current.purchases, renewal] })
          return renewal
        }))
      }))
      if (record !== undefined) records.push(record)
    }
    return records
  }))
  yield* renewDue.pipe(Effect.repeat(Schedule.spaced("1 minute")), Effect.forkScoped)
  return Billing.of({ products: Effect.succeed(products),
    purchase: (input) => Semaphore.withPermit(paymentLock)(purchase(input)), renewDue })
})).pipe(Layer.provide(StateLive), Layer.provide(CoreLive))
