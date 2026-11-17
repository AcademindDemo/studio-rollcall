import { Effect, Layer } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { Api } from "../../api/Api.ts"
import { Waitlist } from "../contracts/Waitlist.ts"
import { WaitlistLive } from "./WaitlistLive.ts"

// Provided here as well as in Server.ts. A stack that reuses HandlersLive, such as the
// booking check-in server, must not gain a new open requirement. One build memoizes one instance.
export const WaitlistHandlersLive = HttpApiBuilder.group(Api, "waitlist", Effect.fn(function*(handlers) {
  const waitlist = yield* Waitlist
  return handlers
    .handle("join", ({ params, payload }) => waitlist.join({ classId: params.id, memberId: payload.memberId }))
    .handle("leave", ({ params }) => waitlist.leave({ classId: params.id, memberId: params.memberId }))
    .handle("forMember", ({ params }) => waitlist.forMember(params.id))
})).pipe(Layer.provide(WaitlistLive))
