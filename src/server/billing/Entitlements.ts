import { DateTime, Effect, Layer, Ref } from "effect"
import { ClassPack, MemberBalance } from "../../domain/Billing.ts"
import type { MemberId } from "../../domain/Member.ts"
import { NoCredit } from "../../domain/Errors.ts"
import { Directory } from "../contracts/Directory.ts"
import { Entitlements } from "../contracts/Entitlements.ts"
import { CoreLive } from "../core/CoreLive.ts"
import { BillingState, StateLive } from "./State.ts"

export const layerLive = Layer.effect(Entitlements, Effect.gen(function*() {
  const state = yield* BillingState
  const directory = yield* Directory
  const balance = Effect.fn("Entitlements.balance")(function*(memberId: MemberId) {
    yield* directory.getMember(memberId)
    const now = yield* DateTime.now
    const data = yield* Ref.get(state)
    const packs = data.packs.filter((p) => p.memberId === memberId && p.remaining > 0 && DateTime.isGreaterThan(p.expiresAt, now))
      .sort((a, b) => DateTime.toEpochMillis(a.expiresAt) - DateTime.toEpochMillis(b.expiresAt))
    const membership = data.memberships.filter((m) => m.memberId === memberId)
      .sort((a, b) => DateTime.toEpochMillis(b.endsAt) - DateTime.toEpochMillis(a.endsAt))[0]
    return new MemberBalance({ memberId, packCreditsLeft: packs.reduce((n, p) => n + p.remaining, 0),
      ...(packs[0] === undefined ? {} : { nextPackExpiry: packs[0].expiresAt }),
      ...(membership === undefined ? {} : { membershipEndsAt: membership.endsAt, renewal: membership.renewal }) })
  })
  return Entitlements.of({
    balance,
    listBalances: directory.listMembers.pipe(Effect.flatMap(Effect.forEach((m) => balance(m.id))), Effect.orDie),
    use: (_held, memberId, session) => Effect.gen(function*() {
      const now = yield* DateTime.now
      const data = yield* Ref.get(state)
      const membership = data.memberships.find((m) => m.memberId === memberId &&
        DateTime.isLessThanOrEqualTo(m.startsAt, session.startsAt) && DateTime.isGreaterThan(m.endsAt, session.startsAt))
      if (membership !== undefined) return { _tag: "Membership", membershipId: membership.id }
      const pack = data.packs.filter((p) => p.memberId === memberId && p.remaining > 0 &&
        DateTime.isGreaterThan(p.expiresAt, now) && DateTime.isGreaterThan(p.expiresAt, session.startsAt))
        .sort((a, b) => DateTime.toEpochMillis(a.expiresAt) - DateTime.toEpochMillis(b.expiresAt))[0]
      if (pack === undefined) return yield* new NoCredit({ memberId, classId: session.id })
      yield* Ref.set(state, { ...data, packs: data.packs.map((p) => p.id === pack.id ? new ClassPack({ id: p.id, memberId: p.memberId, size: p.size, purchasedAt: p.purchasedAt, expiresAt: p.expiresAt, remaining: p.remaining - 1 }) : p) })
      return { _tag: "PackCredit", packId: pack.id }
    }),
    restore: (_held, creditUse) => creditUse._tag === "Membership" ? Effect.void : Ref.update(state, (data) => ({
      ...data, packs: data.packs.map((p) => p.id === creditUse.packId ? new ClassPack({ id: p.id, memberId: p.memberId, size: p.size, purchasedAt: p.purchasedAt, expiresAt: p.expiresAt, remaining: p.remaining + 1 }) : p)
    }))
  })
})).pipe(Layer.provide(StateLive), Layer.provide(CoreLive))
