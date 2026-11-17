import { NodeHttpServer } from "@effect/platform-node"
import { assert, describe, it } from "@effect/vitest"
import { DateTime, Effect, Layer, Ref } from "effect"
import { HttpClient } from "effect/http"
import { HttpApiClient } from "effect/http-api"
import { TestClock } from "effect/testing"
import { Api } from "../src/api/Api.ts"
import { CardToken, MemberBalance, PaymentRef } from "../src/domain/Billing.ts"
import { BookingId } from "../src/domain/Booking.ts"
import { ClassId } from "../src/domain/ClassSession.ts"
import { NoCredit, PaymentDeclined } from "../src/domain/Errors.ts"
import { layerLive as EntitlementsLive } from "../src/server/billing/Entitlements.ts"
import { Billing } from "../src/server/contracts/Billing.ts"
import { Entitlements } from "../src/server/contracts/Entitlements.ts"
import { PaymentProvider } from "../src/server/contracts/PaymentProvider.ts"
import { demoMembers } from "../src/server/Seed.ts"
import { AppLive, ServerLive } from "../src/server/Server.ts"
import { PromotionLive } from "../src/server/waitlist/PromotionLive.ts"

const ada = demoMembers.ada.id
const bo = demoMembers.bo.id
const chen = demoMembers.chen.id
const dara = demoMembers.dara.id
const yoga = ClassId.make("class-d1-1")
const full = ClassId.make("class-d1-3")

const server = ServerLive.pipe(Layer.provideMerge(NodeHttpServer.layerTest))

// Accepts the first charge of the token "decline", then declines it on renewal, so a renewal
// can fail after a successful purchase. The real fake declines that token every time.
const DeclineRenewal = Layer.effect(PaymentProvider, Ref.make(0).pipe(Effect.map((count) => PaymentProvider.of({
  charge: (token) => Ref.getAndUpdate(count, (n) => n + 1).pipe(Effect.flatMap((n) => token === "decline" && n > 0
    ? Effect.fail(new PaymentDeclined({ reason: "Fake renewal decline" }))
    : Effect.succeed(PaymentRef.make(`staff-test-payment-${n}`))))
}))))
const decliningServer = AppLive.pipe(
  Layer.provide(PromotionLive),
  Layer.provideMerge(Layer.mergeAll(EntitlementsLive, DeclineRenewal)),
  Layer.provideMerge(NodeHttpServer.layerTest)
)

// Fixed balances relative to the test clock's start (epoch 0). The real layers can't make a
// membership that ends in the future without an active renewal, so this seam does.
const day = 24 * 60 * 60 * 1000
const at = (days: number) => DateTime.makeUnsafe(days * day)
const fixedBalances = (balances: ReadonlyArray<MemberBalance>) => Layer.succeed(Entitlements)(Entitlements.of({
  use: (_held, memberId, session) => Effect.fail(new NoCredit({ memberId, classId: session.id })),
  restore: () => Effect.void,
  balance: (memberId) => Effect.succeed(new MemberBalance({ memberId, packCreditsLeft: 0 })),
  listBalances: Effect.succeed(balances)
}))
const fixedServer = (balances: ReadonlyArray<MemberBalance>) => AppLive.pipe(
  Layer.provide(PromotionLive),
  Layer.provideMerge(Layer.mergeAll(fixedBalances(balances), DeclineRenewal)),
  Layer.provideMerge(NodeHttpServer.layerTest)
)
const mixedServer = fixedServer([
  // Ada: an active renewal, so ending in 2 days is not a warning.
  new MemberBalance({ memberId: ada, packCreditsLeft: 0, membershipEndsAt: at(2), renewal: "active" }),
  // Bo: a pack with credits left expiring in 5 days.
  new MemberBalance({ memberId: bo, packCreditsLeft: 3, nextPackExpiry: at(5) }),
  // Chen: a membership ending in 6 days whose renewal has failed.
  new MemberBalance({ memberId: chen, packCreditsLeft: 0, membershipEndsAt: at(6), renewal: "failed" }),
  // Dara: a pack expiring in 8 days, outside the 7-day window.
  new MemberBalance({ memberId: dara, packCreditsLeft: 1, nextPackExpiry: at(8) })
])
// Read with the clock at day 1: exactly 7 days ahead is in the window, 1 ms more is not,
// and a pack expiry already past is not "expiring soon".
const edgeServer = fixedServer([
  new MemberBalance({ memberId: ada, packCreditsLeft: 0, membershipEndsAt: at(8) }),
  new MemberBalance({ memberId: bo, packCreditsLeft: 2, nextPackExpiry: at(8) }),
  new MemberBalance({ memberId: chen, packCreditsLeft: 2, membershipEndsAt: DateTime.makeUnsafe(8 * day + 1),
    nextPackExpiry: DateTime.makeUnsafe(8 * day + 1) }),
  new MemberBalance({ memberId: dara, packCreditsLeft: 1, nextPackExpiry: DateTime.makeUnsafe(day / 2) })
])

describe("staff weekly classes over HTTP", () => {
  it.effect("an added weekly class is listed and appears in /classes", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    const added = yield* client.staff.addWeeklyClass({ payload: {
      title: "Lunch Pilates", weekday: "wednesday", startTime: "13:30", durationMinutes: 50,
      room: "Studio B", instructor: "Ines", capacity: 8
    } })
    assert.strictEqual(added.title, "Lunch Pilates")
    const weekly = yield* client.staff.listWeeklyClasses()
    assert.isDefined(weekly.find((w) => w.id === added.id))
    const sessions = (yield* client.studio.listClasses()).filter((c) => c.weeklyClassId === added.id)
    assert.lengthOf(sessions, 1)
    const session = sessions[0]
    assert.isDefined(session)
    assert.strictEqual(session.title, "Lunch Pilates")
    assert.strictEqual(session.spotsLeft, 8)
    assert.strictEqual(DateTime.getPartUtc(session.startsAt, "weekDay"), 3)
    assert.strictEqual(DateTime.getPartUtc(session.startsAt, "hour"), 13)
    assert.strictEqual(DateTime.getPartUtc(session.startsAt, "minute"), 30)
    const staffSessions = (yield* client.staff.listClasses()).filter((c) => c.weeklyClassId === added.id)
    assert.deepStrictEqual(staffSessions.map((c) => c.id), [session.id])
  }).pipe(Effect.provide(server)))

  it.effect("a weekly class in a room the studio doesn't have is rejected", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    const before = yield* client.staff.listWeeklyClasses()
    const rejected = yield* client.staff.addWeeklyClass({ payload: {
      title: "Rooftop Yoga", weekday: "friday", startTime: "08:00", durationMinutes: 60,
      room: "Roof", instructor: "Maya", capacity: 8
    } }).pipe(Effect.flip)
    assert.strictEqual(rejected._tag, "InvalidWeeklyClass")
    assert.lengthOf(yield* client.staff.listWeeklyClasses(), before.length)
  }).pipe(Effect.provide(server)))
})

describe("staff roster and check-in over HTTP", () => {
  it.effect("the roster shows bookings and the waitlist in order", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    yield* client.waitlist.join({ params: { id: full }, payload: { memberId: dara } })
    yield* TestClock.adjust(1)
    yield* client.waitlist.join({ params: { id: full }, payload: { memberId: ada } })
    const roster = yield* client.staff.roster({ params: { id: full } })
    assert.strictEqual(roster.classListing.id, full)
    assert.strictEqual(roster.classListing.spotsLeft, 0)
    assert.deepStrictEqual(roster.bookings.map((b) => [b.memberId, b.status]), [[bo, "booked"], [chen, "booked"]])
    assert.deepStrictEqual(roster.waitlist.map((w) => [w.memberId, w.status]), [[dara, "waiting"], [ada, "waiting"]])

    // A cancel promotes the first waiter; the roster shows the change in order.
    const boBooking = roster.bookings.find((b) => b.memberId === bo)
    assert.isDefined(boBooking)
    yield* client.bookings.cancel({ params: { id: boBooking.id }, payload: { memberId: bo } })
    const after = yield* client.staff.roster({ params: { id: full } })
    // Bookings come in `bookedAt` order. The seeded ones are dated at the start of the seeded
    // week (tomorrow), so Dara's promotion, booked now, comes first.
    assert.deepStrictEqual(after.bookings.map((b) => [b.memberId, b.status, b.source]),
      [[dara, "booked", "waitlist"], [bo, "cancelled", "member"], [chen, "booked", "member"]])
    assert.deepStrictEqual(after.waitlist.map((w) => [w.memberId, w.status]), [[dara, "promoted"], [ada, "waiting"]])

    const missing = yield* client.staff.roster({ params: { id: ClassId.make("no-such-class") } }).pipe(Effect.flip)
    assert.strictEqual(missing._tag, "ClassNotFound")
  }).pipe(Effect.provide(server)))

  it.effect("check-in works once, and the second time gives AlreadyCheckedIn", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    const booking = yield* client.bookings.book({ payload: { classId: yoga, memberId: ada } })
    const before = yield* client.staff.roster({ params: { id: yoga } })
    assert.isUndefined(before.bookings.find((b) => b.id === booking.id)?.checkedInAt)

    yield* TestClock.adjust("1 hour")
    const checked = yield* client.staff.checkIn({ params: { id: booking.id } })
    assert.strictEqual(checked.status, "booked")
    assert.deepStrictEqual(checked.checkedInAt, yield* DateTime.now)
    const again = yield* client.staff.checkIn({ params: { id: booking.id } }).pipe(Effect.flip)
    assert.strictEqual(again._tag, "AlreadyCheckedIn")

    const after = yield* client.staff.roster({ params: { id: yoga } })
    assert.deepStrictEqual(after.bookings.find((b) => b.id === booking.id)?.checkedInAt, checked.checkedInAt)
  }).pipe(Effect.provide(server)))

  it.effect("check-in of a cancelled or unknown booking fails", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    const booking = yield* client.bookings.book({ payload: { classId: yoga, memberId: ada } })
    yield* client.bookings.cancel({ params: { id: booking.id }, payload: { memberId: ada } })
    const cancelled = yield* client.staff.checkIn({ params: { id: booking.id } }).pipe(Effect.flip)
    assert.strictEqual(cancelled._tag, "BookingNotActive")
    const unknown = yield* client.staff.checkIn({ params: { id: BookingId.make("no-such-booking") } }).pipe(Effect.flip)
    assert.strictEqual(unknown._tag, "BookingNotFound")
  }).pipe(Effect.provide(server)))
})

describe("staff members over HTTP", () => {
  it.effect("flags a membership ending soon without an active renewal, then a pack expiring soon", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    const rows = yield* client.staff.members()
    assert.deepStrictEqual(rows.map((r) => [r.member.id, r.flags]), [
      [chen, ["membershipEndingSoon", "renewalFailed"]],
      [bo, ["packExpiringSoon"]],
      [ada, []],
      [dara, []]
    ])
    assert.strictEqual(rows[1]?.balance.packCreditsLeft, 3)
  }).pipe(Effect.provide(mixedServer)))

  it.effect("the 7-day window includes its last instant and excludes expiries already past", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    yield* TestClock.setTime(day)
    const rows = yield* client.staff.members()
    assert.deepStrictEqual(rows.map((r) => [r.member.id, r.flags]), [
      [ada, ["membershipEndingSoon"]],
      [bo, ["packExpiringSoon"]],
      [chen, []],
      [dara, []]
    ])
  }).pipe(Effect.provide(edgeServer)))

  it.effect("with the real billing layers, flags a failed renewal and packs expiring soon", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    const billing = yield* Billing
    const start = yield* client.staff.members()
    assert.deepStrictEqual(start.map((r) => r.flags), [[], [], [], []])

    yield* client.billing.purchase({ payload: { memberId: chen, productId: "monthly", cardToken: CardToken.make("decline") } })
    yield* TestClock.adjust("30 days")
    yield* billing.renewDue
    const renewed = yield* client.staff.members()
    assert.strictEqual(renewed[0]?.member.id, chen)
    assert.deepStrictEqual(renewed[0]?.flags, ["renewalFailed"])
    assert.strictEqual(renewed[0]?.balance.renewal, "failed")

    // The seeded packs (Bo, Dara) expire 3 months after the start; move to 3 days before that.
    const expiry = renewed.find((r) => r.member.id === bo)?.balance.nextPackExpiry
    assert.isDefined(expiry)
    yield* TestClock.setTime(expiry.epochMilliseconds - 3 * day)
    const late = yield* client.staff.members()
    assert.deepStrictEqual(late.map((r) => [r.member.id, r.flags]), [
      [chen, ["renewalFailed"]],
      [bo, ["packExpiringSoon"]],
      [dara, ["packExpiringSoon"]],
      [ada, []]
    ])
    assert.strictEqual(late.find((r) => r.member.id === ada)?.balance.renewal, "active")
  }).pipe(Effect.provide(decliningServer)))
})

describe("staff page", () => {
  it.effect("GET /staff/ is one HTML page that uses only the /staff endpoints", () => Effect.gen(function*() {
    const response = yield* HttpClient.get("/staff/")
    assert.strictEqual(response.status, 200)
    assert.match(response.headers["content-type"] ?? "", /^text\/html/)
    const html = yield* response.text
    for (const path of [
      "\"/staff/classes\"", "\"/staff/classes/\"", "\"/roster\"", "\"/staff/bookings/\"", "\"/check-in\"",
      "\"/staff/members\"", "\"/staff/weekly-classes\""
    ]) assert.include(html, path)
    // Every request the script makes goes to a /staff endpoint, and nothing is loaded from elsewhere.
    const calls = [...html.matchAll(/api\("(GET|POST)", "([^"]*)"/g)].map((m) => m[2])
    assert.isAbove(calls.length, 0)
    for (const path of calls) assert.match(path ?? "", /^\/staff\//)
    assert.notMatch(html, /<(script|link)[^>]+(src|href)=/)
  }).pipe(Effect.provide(server)))
})
