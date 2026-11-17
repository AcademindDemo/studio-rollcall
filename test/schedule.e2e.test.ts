import { NodeHttpServer } from "@effect/platform-node"
import { assert, describe, it } from "@effect/vitest"
import { DateTime, Effect, Layer } from "effect"
import { HttpApiClient } from "effect/http-api"
import { TestClock } from "effect/testing"
import { Api } from "../src/api/Api.ts"
import { Schedule } from "../src/server/contracts/Schedule.ts"
import { ServerLive } from "../src/server/Server.ts"

const server = ServerLive.pipe(Layer.provideMerge(NodeHttpServer.layerTest))

describe("weekly schedule over HTTP", () => {
  it.effect("keeps studio and demo classes, expands templates and retains occurrence ids", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    const studio = yield* client.studio.get()
    const before = yield* client.studio.listClasses()
    assert.strictEqual(before.length, 21)
    assert.isTrue(before.every((c) => c.studioId === studio.id && c.weeklyClassId !== undefined))
    const full = before.find((c) => c.id === "class-d1-3")
    assert.isDefined(full)
    assert.strictEqual(full.spotsLeft, 0)
    const service = yield* Schedule
    const first = before[0]
    assert.isDefined(first)
    const weekday = (yield* service.listWeeklyClasses).find((w) => w.id === first.weeklyClassId)?.weekday
    assert.isDefined(weekday)
    const added = yield* service.addWeeklyClass({ title: "New class", weekday, startTime: "09:30", durationMinutes: 45, room: studio.rooms[0] ?? "Studio A", instructor: "Instructor", capacity: 3 })
    const after = yield* client.studio.listClasses()
    const session = after.find((c) => c.weeklyClassId === added.id)
    assert.isDefined(session)
    assert.strictEqual(DateTime.getPartUtc(session.startsAt, "hour"), 9)
    assert.strictEqual(DateTime.getPartUtc(session.startsAt, "minute"), 30)
    assert.strictEqual(session.spotsLeft, 3)
    assert.deepStrictEqual((yield* client.studio.listClasses()).map((c) => c.id), after.map((c) => c.id))
    yield* TestClock.adjust("7 days")
    const next = yield* client.studio.listClasses()
    assert.isTrue(next.some((c) => c.weeklyClassId === added.id && c.id !== session.id))
    assert.strictEqual((yield* service.getClass(first.id)).id, first.id)
  }).pipe(Effect.provide(server)))

  it.effect("rejects an unknown room without changing the HTTP schedule", () => Effect.gen(function*() {
    const client = yield* HttpApiClient.make(Api)
    const before = yield* client.studio.listClasses()
    const service = yield* Schedule
    const result = yield* service.addWeeklyClass({ title: "Invalid", weekday: "monday", startTime: "09:00", durationMinutes: 30, room: "Unknown", instructor: "Instructor", capacity: 1 }).pipe(Effect.flip)
    assert.strictEqual(result._tag, "InvalidWeeklyClass")
    assert.deepStrictEqual(yield* client.studio.listClasses(), before)
  }).pipe(Effect.provide(server)))
})
