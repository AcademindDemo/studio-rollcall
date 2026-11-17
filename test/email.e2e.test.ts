import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { NodeHttpServer } from "@effect/platform-node"
import { assert, describe, it, layer } from "@effect/vitest"
import { DateTime, Effect, Layer } from "effect"
import { HttpApiClient } from "effect/http-api"
import { TestClock } from "effect/testing"
import { Api } from "../src/api/Api.ts"
import { MembershipId } from "../src/domain/Billing.ts"
import { Booking, BookingId } from "../src/domain/Booking.ts"
import type { ClassListing } from "../src/domain/ClassSession.ts"
import { BookingConfirmed } from "../src/domain/Events.ts"
import { BookingEvents } from "../src/server/contracts/BookingEvents.ts"
import { Bookings } from "../src/server/contracts/Bookings.ts"
import { Outbox } from "../src/server/contracts/Outbox.ts"
import { Promotion } from "../src/server/contracts/Promotion.ts"
import { StudioLock } from "../src/server/contracts/StudioLock.ts"
import { layerLive as EntitlementsLive } from "../src/server/billing/Entitlements.ts"
import { layerFake } from "../src/server/billing/PaymentProvider.ts"
import { demoMembers } from "../src/server/Seed.ts"
import { AppLive } from "../src/server/Server.ts"

// Part 2 deleted the no-promotion placeholder. This server still wants that behaviour.
const layerNone = Layer.succeed(Promotion)(Promotion.of({ onSpotFreed: () => Effect.succeed([]) }))

// AppLive leaves entitlements, payment and promotion open. The waitlist event is published here.
const TestApp = AppLive.pipe(
  Layer.provideMerge(Layer.mergeAll(EntitlementsLive, layerFake)),
  Layer.provideMerge(layerNone),
  Layer.provideMerge(NodeHttpServer.layerTest)
)

const hourMs = 60 * 60 * 1000
const minuteMs = 60 * 1000

const networkImport = /["'](?:nodemailer(?:\/[^"']*)?|undici|axios|node:(?:net|http2?|https|dns|dgram|tls)|ws)["']/

const earliestWithSpots = (classes: ReadonlyArray<ClassListing>, spots: number) =>
  classes.reduce<ClassListing | undefined>((soonest, session) => {
    if (session.spotsLeft < spots) {
      return soonest
    }
    if (soonest === undefined || session.startsAt.epochMilliseconds < soonest.startsAt.epochMilliseconds) {
      return session
    }
    return soonest
  }, undefined)

describe("email modules", () => {
  it("do not import a network or SMTP library", () => {
    const dir = join(import.meta.dirname, "../src/server/email")
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".ts")) {
        continue
      }
      const source = readFileSync(join(dir, name), "utf8")
      assert.isFalse(networkImport.test(source), name)
    }
  })
})

layer(TestApp, { buildPerTest: true })("emails over HTTP", (it) => {
  it.effect("a booking writes a confirmation and no promotion email", () =>
    Effect.gen(function*() {
      const client = yield* HttpApiClient.make(Api)
      const outbox = yield* Outbox
      const classes = yield* client.studio.listClasses()
      const target = earliestWithSpots(classes, 1)
      assert.isDefined(target)

      const booking = yield* client.bookings.book({
        payload: { classId: target.id, memberId: demoMembers.ada.id }
      })
      // Direct step, so the assertion does not wait on the subscriber fiber.
      yield* outbox.onEvent(new BookingConfirmed({ booking }))

      const emails = yield* client.outbox.list({ query: { bookingId: booking.id } })
      assert.strictEqual(emails.length, 1)
      const email = emails[0]
      assert.isDefined(email)
      assert.strictEqual(email.kind, "BookingConfirmed")
      assert.strictEqual(email.to, demoMembers.ada.email)
      assert.strictEqual(email.bookingId, booking.id)
      assert.isTrue(email.body.includes(target.title))
      assert.isTrue(email.body.includes(target.room))
      assert.isTrue(email.body.includes(target.instructor))
      assert.isUndefined(emails.find((item) => item.kind === "WaitlistPromoted"))
    }))

  it.effect("a waitlist BookingConfirmed writes a promotion email with the class details", () =>
    Effect.gen(function*() {
      const client = yield* HttpApiClient.make(Api)
      const outbox = yield* Outbox
      const lock = yield* StudioLock
      const events = yield* BookingEvents
      const classes = yield* client.studio.listClasses()
      const target = earliestWithSpots(classes, 1)
      assert.isDefined(target)

      const booking = new Booking({
        id: BookingId.make("booking-from-waitlist"),
        classId: target.id,
        memberId: demoMembers.ada.id,
        bookedAt: yield* DateTime.now,
        source: "waitlist",
        status: "booked",
        creditUse: { _tag: "Membership", membershipId: MembershipId.make("allow-all") }
      })

      const event = new BookingConfirmed({ booking })
      yield* lock.withLock((held) => events.publish(held, event))
      yield* outbox.onEvent(event)

      const emails = yield* client.outbox.list({ query: { bookingId: booking.id } })
      assert.strictEqual(emails.length, 1)
      const email = emails[0]
      assert.isDefined(email)
      assert.strictEqual(email.kind, "WaitlistPromoted")
      assert.strictEqual(email.to, demoMembers.ada.email)
      assert.isTrue(email.body.includes(target.title))
      assert.isTrue(email.body.includes(DateTime.formatIso(target.startsAt)))
      assert.isTrue(email.body.includes(target.room))
      assert.isTrue(email.body.includes(target.instructor))
      assert.isTrue(email.body.includes(String(target.durationMinutes)))
      assert.isUndefined(emails.find((item) => item.kind === "BookingConfirmed"))
    }))

  it.effect("sweepReminders writes one reminder inside 24h, skips duplicates and cancellations", () =>
    Effect.gen(function*() {
      const client = yield* HttpApiClient.make(Api)
      const outbox = yield* Outbox
      const bookings = yield* Bookings
      const classes = yield* client.studio.listClasses()
      const target = earliestWithSpots(classes, 2)
      assert.isDefined(target)

      const ada = yield* client.bookings.book({
        payload: { classId: target.id, memberId: demoMembers.ada.id }
      })
      const dara = yield* client.bookings.book({
        payload: { classId: target.id, memberId: demoMembers.dara.id }
      })

      const now = yield* DateTime.now
      const start = target.startsAt.epochMilliseconds
      yield* TestClock.adjust(start - 24 * hourMs - minuteMs - now.epochMilliseconds)
      yield* outbox.sweepReminders
      const tooEarly = yield* client.outbox.list({ query: { kind: "ClassReminder" } })
      assert.strictEqual(tooEarly.length, 0)

      yield* bookings.cancel({ bookingId: dara.id, memberId: demoMembers.dara.id })

      yield* TestClock.adjust(2 * minuteMs)
      yield* outbox.sweepReminders
      const once = yield* client.outbox.list({ query: { kind: "ClassReminder" } })
      assert.strictEqual(once.length, 1)
      const reminder = once[0]
      assert.isDefined(reminder)
      assert.strictEqual(reminder.bookingId, ada.id)
      assert.strictEqual(reminder.to, demoMembers.ada.email)
      assert.isTrue(reminder.body.includes(target.title))
      assert.isUndefined(once.find((email) => email.bookingId === dara.id))

      const second = yield* outbox.sweepReminders
      assert.strictEqual(second.length, 0)
      const stillOne = yield* client.outbox.list({ query: { kind: "ClassReminder" } })
      assert.strictEqual(stillOne.length, 1)

      // Booked after the window has opened: the next sweep sends the reminder.
      const bo = yield* client.bookings.book({
        payload: { classId: target.id, memberId: demoMembers.bo.id }
      })
      const beforeBo = yield* client.outbox.list({ query: { bookingId: bo.id, kind: "ClassReminder" } })
      assert.strictEqual(beforeBo.length, 0)
      yield* outbox.sweepReminders
      const withBo = yield* client.outbox.list({ query: { kind: "ClassReminder" } })
      assert.strictEqual(withBo.length, 2)
      assert.isDefined(withBo.find((email) => email.bookingId === bo.id))
      yield* outbox.sweepReminders
      const stillTwo = yield* client.outbox.list({ query: { kind: "ClassReminder" } })
      assert.strictEqual(stillTwo.length, 2)
    }))
})
