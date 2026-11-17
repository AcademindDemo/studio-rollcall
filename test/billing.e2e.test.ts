import { NodeHttpServer } from "@effect/platform-node"
import { assert, layer } from "@effect/vitest"
import { DateTime, Effect, Layer, Ref } from "effect"
import { TestClock } from "effect/testing"
import { HttpClient, HttpClientRequest } from "effect/http"
import { HttpApiClient } from "effect/http-api"
import { Api } from "../src/api/Api.ts"
import { CardToken, ClassPackId, PaymentRef } from "../src/domain/Billing.ts"
import { MemberId } from "../src/domain/Member.ts"
import { PaymentDeclined } from "../src/domain/Errors.ts"
import { Billing } from "../src/server/contracts/Billing.ts"
import { PaymentProvider } from "../src/server/contracts/PaymentProvider.ts"
import { demoMembers } from "../src/server/Seed.ts"
import { ServerLive, AppLive } from "../src/server/Server.ts"
import { layerLive as EntitlementsLive } from "../src/server/billing/Entitlements.ts"
import { Promotion } from "../src/server/contracts/Promotion.ts"
import { BillingState, StateLive } from "../src/server/billing/State.ts"

// Part 2 deleted the no-promotion placeholder. This server still wants that behaviour.
const layerNone = Layer.succeed(Promotion)(Promotion.of({ onSpotFreed: () => Effect.succeed([]) }))

const TestServer = ServerLive.pipe(Layer.provideMerge(StateLive), Layer.provideMerge(NodeHttpServer.layerTest))
const cardToken = CardToken.make("fake-card")
const memberId = demoMembers.chen.id

layer(TestServer, { buildPerTest: true })("billing over HTTP", (it) => {
  it.effect("catalogue, pack exhaustion and failed payment leave the balance correct", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    const products = yield* client.billing.products()
    assert.deepStrictEqual(products.map((p) => [p.id, p.priceCents, p.currency]), [
      ["pack-5", 6500, "EUR"], ["pack-10", 12000, "EUR"], ["monthly", 8900, "EUR"]
    ])
    const before = yield* client.billing.balance({ params: { id: memberId } })
    assert.strictEqual(before.packCreditsLeft, 0)
    const declined = yield* client.billing.purchase({ payload: { memberId, productId: "pack-5", cardToken: CardToken.make("decline") } }).pipe(Effect.flip)
    assert.strictEqual(declined._tag, "PaymentDeclined")
    assert.deepStrictEqual(yield* client.billing.balance({ params: { id: memberId } }), before)
    const purchase = yield* client.billing.purchase({ payload: { memberId, productId: "pack-5", cardToken } })
    assert.strictEqual(purchase.amountCents, 6500)
    assert.strictEqual(purchase.reason, "purchase")
    const classes = (yield* client.studio.listClasses()).filter((c) => c.spotsLeft > 0)
    for (const session of classes.slice(0, 5)) {
      const booking = yield* client.bookings.book({ payload: { memberId, classId: session.id } })
      assert.strictEqual(booking.creditUse._tag, "PackCredit")
    }
    assert.strictEqual((yield* client.billing.balance({ params: { id: memberId } })).packCreditsLeft, 0)
    const next = classes[5]
    assert.isDefined(next)
    const exhausted = yield* client.bookings.book({ payload: { memberId, classId: next.id } }).pipe(Effect.flip)
    assert.strictEqual(exhausted._tag, "NoCredit")
  }))

  it.effect("unknown members are rejected before payment and have no balance", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    const unknown = MemberId.make("member-missing")
    const rejected = yield* client.billing.purchase({ payload: { memberId: unknown, productId: "pack-5", cardToken: CardToken.make("decline") } }).pipe(Effect.flip)
    assert.strictEqual(rejected._tag, "MemberNotFound")
    const balance = yield* client.billing.balance({ params: { id: unknown } }).pipe(Effect.flip)
    assert.strictEqual(balance._tag, "MemberNotFound")
  }))

  it.effect("an active monthly membership is rejected before charging a declined card", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    yield* client.billing.purchase({ payload: { memberId, productId: "monthly", cardToken } })
    const before = yield* client.billing.balance({ params: { id: memberId } })
    const rejected = yield* client.billing.purchase({ payload: { memberId, productId: "monthly", cardToken: CardToken.make("decline") } }).pipe(Effect.flip)
    assert.strictEqual(rejected._tag, "AlreadyMember")
    assert.deepStrictEqual(yield* client.billing.balance({ params: { id: memberId } }), before)
  }))

  it.effect("unknown product ids fail HTTP schema decoding without changing the balance", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    const before = yield* client.billing.balance({ params: { id: memberId } })
    const request = yield* HttpClientRequest.post("/purchases").pipe(HttpClientRequest.bodyJson({
      memberId, productId: "unknown-product", cardToken
    }))
    const response = yield* HttpClient.execute(request)
    assert.strictEqual(response.status, 400)
    assert.deepStrictEqual(yield* client.billing.balance({ params: { id: memberId } }), before)
  }))

  it.effect("an early cancellation restores the pack credit and a late cancellation spends it", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    yield* client.billing.purchase({ payload: { memberId, productId: "pack-5", cardToken } })
    const target = (yield* client.studio.listClasses()).find((c) => c.spotsLeft > 0)
    assert.isDefined(target)
    const first = yield* client.bookings.book({ payload: { memberId, classId: target.id } })
    assert.strictEqual(first.creditUse._tag, "PackCredit")
    assert.strictEqual((yield* client.billing.balance({ params: { id: memberId } })).packCreditsLeft, 4)
    const now = yield* DateTime.now
    yield* TestClock.adjust(target.startsAt.epochMilliseconds - now.epochMilliseconds - 12 * 60 * 60 * 1000)
    yield* client.bookings.cancel({ params: { id: first.id }, payload: { memberId } })
    assert.strictEqual((yield* client.billing.balance({ params: { id: memberId } })).packCreditsLeft, 5)
    const second = yield* client.bookings.book({ payload: { memberId, classId: target.id } })
    yield* TestClock.adjust("1 second")
    yield* client.bookings.cancel({ params: { id: second.id }, payload: { memberId } })
    assert.strictEqual((yield* client.billing.balance({ params: { id: memberId } })).packCreditsLeft, 4)
  }))

  it.effect("seed balances include a membership, pack, empty balance and last credit", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    const balances = yield* Effect.forEach(Object.values(demoMembers), (member) => client.billing.balance({ params: { id: member.id } }))
    assert.deepStrictEqual(balances.map((balance) => balance.packCreditsLeft), [0, 10, 0, 1])
    assert.strictEqual(balances[0]?.renewal, "active")
  }))

  it.effect("uses the pack expiring soonest first", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    const first = yield* client.billing.purchase({ payload: { memberId, productId: "pack-5", cardToken } })
    yield* TestClock.adjust("1 hour")
    yield* client.billing.purchase({ payload: { memberId, productId: "pack-10", cardToken } })
    const target = (yield* client.studio.listClasses()).find((c) => c.spotsLeft > 0)
    assert.isDefined(target)
    const booking = yield* client.bookings.book({ payload: { memberId, classId: target.id } })
    assert.deepStrictEqual(booking.creditUse, { _tag: "PackCredit", packId: ClassPackId.make(first.id) })
    assert.strictEqual((yield* client.billing.balance({ params: { id: memberId } })).packCreditsLeft, 14)
  }))

  it.effect("membership pays first, preserving pack credits; monthly purchases serialize", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    yield* client.billing.purchase({ payload: { memberId, productId: "pack-10", cardToken } })
    const results = yield* Effect.all([1, 2].map(() => client.billing.purchase({ payload: { memberId, productId: "monthly", cardToken } }).pipe(Effect.result)), { concurrency: "unbounded" })
    assert.strictEqual(results.filter((r) => r._tag === "Success").length, 1)
    const failure = results.find((r) => r._tag === "Failure")
    assert.isDefined(failure)
    assert.strictEqual(failure.failure._tag, "AlreadyMember")
    const target = (yield* client.studio.listClasses()).find((c) => c.spotsLeft > 0)
    assert.isDefined(target)
    const booking = yield* client.bookings.book({ payload: { memberId, classId: target.id } })
    assert.strictEqual(booking.creditUse._tag, "Membership")
    assert.strictEqual((yield* client.billing.balance({ params: { id: memberId } })).packCreditsLeft, 10)
  }))

  it.effect("pack cannot cover a class after expiry and expired credits disappear", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    const target = (yield* client.studio.listClasses()).find((c) => c.spotsLeft > 0)
    assert.isDefined(target)
    // Keep the real seeded schedule while purchasing more than three calendar months before the class.
    const purchasedAt = DateTime.subtract(target.startsAt, { months: 3, days: 1 })
    yield* TestClock.setTime(DateTime.toEpochMillis(purchasedAt))
    const purchase = yield* client.billing.purchase({ payload: { memberId, productId: "pack-5", cardToken } })
    const balance = yield* client.billing.balance({ params: { id: memberId } })
    assert.strictEqual(balance.packCreditsLeft, 5)
    assert.deepStrictEqual(balance.nextPackExpiry, DateTime.add(purchase.at, { months: 3 }))
    const rejected = yield* client.bookings.book({ payload: { memberId, classId: target.id } }).pipe(Effect.flip)
    assert.strictEqual(rejected._tag, "NoCredit")
    yield* TestClock.adjust("100 days")
    assert.strictEqual((yield* client.billing.balance({ params: { id: memberId } })).packCreditsLeft, 0)
  }))

  it.effect("renewDue before 30 days does nothing, and two due passes record one renewal", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    const billing = yield* Billing
    const purchase = yield* client.billing.purchase({ payload: { memberId, productId: "monthly", cardToken } })
    yield* TestClock.adjust("29 days")
    assert.lengthOf(yield* billing.renewDue, 0)
    assert.deepStrictEqual((yield* client.billing.balance({ params: { id: memberId } })).membershipEndsAt, DateTime.add(purchase.at, { days: 30 }))
    yield* TestClock.adjust("1 day")
    // The scheduled pass may already have run. Inspect committed records after explicit steps.
    yield* billing.renewDue
    yield* billing.renewDue
    const balance = yield* client.billing.balance({ params: { id: memberId } })
    assert.deepStrictEqual(balance.membershipEndsAt, DateTime.add(purchase.at, { days: 60 }))
    const state = yield* BillingState
    const data = yield* Ref.get(state)
    assert.lengthOf(data.purchases.filter((p) => p.memberId === memberId && p.reason === "renewal"), 1)
  }))
})

// A provider seam permits the first charge, then declines the saved "decline" token on renewal.
const DeclineRenewal = Layer.effect(PaymentProvider, Ref.make(0).pipe(Effect.map((count) => PaymentProvider.of({
  charge: (token) => Ref.getAndUpdate(count, (n) => n + 1).pipe(Effect.flatMap((n) => token === "decline" && n > 0
    ? Effect.fail(new PaymentDeclined({ reason: "Fake renewal decline" }))
    : Effect.succeed(PaymentRef.make(`test-payment-${n}`))))
}))))
const DecliningServer = AppLive.pipe(Layer.provide(EntitlementsLive), Layer.provide(layerNone),
  Layer.provide(DeclineRenewal), Layer.provideMerge(NodeHttpServer.layerTest))

layer(DecliningServer, { buildPerTest: true })("declined renewal over HTTP", (it) => {
  it.effect("failed renewal ends coverage and is not retried", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    const billing = yield* Billing
    const target = (yield* client.studio.listClasses()).find((c) => c.spotsLeft > 0)
    assert.isDefined(target)
    // Start this membership 30 days before the future class; renewal fails at the test's current time.
    yield* TestClock.setTime(DateTime.toEpochMillis(DateTime.subtract(target.startsAt, { days: 31 })))
    const purchase = yield* client.billing.purchase({ payload: { memberId, productId: "monthly", cardToken: CardToken.make("decline") } })
    yield* TestClock.adjust("30 days")
    yield* billing.renewDue
    const balance = yield* client.billing.balance({ params: { id: memberId } })
    assert.strictEqual(balance.renewal, "failed")
    assert.deepStrictEqual(balance.membershipEndsAt, DateTime.add(purchase.at, { days: 30 }))
    assert.lengthOf(yield* billing.renewDue, 0)
    const rejected = yield* client.bookings.book({ payload: { memberId, classId: target.id } }).pipe(Effect.flip)
    assert.strictEqual(rejected._tag, "NoCredit")
  }))
})
