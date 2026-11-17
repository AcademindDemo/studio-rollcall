import { NodeHttpServer } from "@effect/platform-node"
import { assert, layer } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { HttpApiClient } from "effect/http-api"
import { Api } from "../src/api/Api.ts"
import { ClassId } from "../src/domain/ClassSession.ts"
import { demoMembers } from "../src/server/Seed.ts"
import { ServerLive } from "../src/server/Server.ts"

// Boots the real server on an ephemeral port and talks to it over HTTP.
const TestServer = ServerLive.pipe(Layer.provideMerge(NodeHttpServer.layerTest))

layer(TestServer)("booking over HTTP", (it) => {
  it.effect("books a class and the spot is taken", () =>
    Effect.gen(function*() {
      const client = yield* HttpApiClient.make(Api)

      const before = yield* client.studio.listClasses()
      assert.strictEqual(before.length, 21)
      const target = before.find((c) => c.spotsLeft > 0)
      assert.isDefined(target)

      const booking = yield* client.bookings.book({
        payload: { classId: target.id, memberId: demoMembers.ada.id }
      })
      assert.strictEqual(booking.classId, target.id)
      assert.strictEqual(booking.memberId, demoMembers.ada.id)

      const after = yield* client.studio.listClasses()
      assert.strictEqual(after.find((c) => c.id === target.id)?.spotsLeft, target.spotsLeft - 1)

      const again = yield* client.bookings.book({
        payload: { classId: target.id, memberId: demoMembers.ada.id }
      }).pipe(Effect.flip)
      assert.strictEqual(again._tag, "AlreadyBooked")

      const full = yield* client.bookings.book({
        payload: { classId: ClassId.make("class-d1-3"), memberId: demoMembers.dara.id }
      }).pipe(Effect.flip)
      assert.strictEqual(full._tag, "ClassFull")
    }))
})
