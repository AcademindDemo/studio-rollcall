// Shared by WaitlistLive and PromotionLive. One layer build memoizes this once per app,
// the same way billing shares its state, so a join and the promotion inside cancel
// see the same queue.
import { Context, Layer, Ref } from "effect"
import type { WaitlistEntry } from "../../domain/Waitlist.ts"

export class WaitlistEntries extends Context.Service<WaitlistEntries, Ref.Ref<ReadonlyArray<WaitlistEntry>>>()(
  "rollcall/waitlist/Entries"
) {}

export const EntriesLive = Layer.effect(WaitlistEntries, Ref.make<ReadonlyArray<WaitlistEntry>>([]))

export const byJoinedAt = (entries: ReadonlyArray<WaitlistEntry>): ReadonlyArray<WaitlistEntry> =>
  [...entries].sort((a, b) => a.joinedAt.epochMilliseconds - b.joinedAt.epochMilliseconds)
