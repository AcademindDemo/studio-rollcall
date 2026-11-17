import { Context } from "effect"
import type { Effect } from "effect"
import type { MemberBalance } from "../../domain/Billing.ts"
import type { CreditUse } from "../../domain/Booking.ts"
import type { ClassSession } from "../../domain/ClassSession.ts"
import type { MemberNotFound, NoCredit } from "../../domain/Errors.ts"
import type { MemberId } from "../../domain/Member.ts"
import type { LockHeld } from "./StudioLock.ts"

// The only way booking touches credits. `use` and `restore` run inside the caller's lock.
export class Entitlements extends Context.Service<Entitlements, {
  // Takes what pays for the class: a membership covering its start, else one pack credit.
  use(held: LockHeld, memberId: MemberId, classSession: ClassSession): Effect.Effect<CreditUse, NoCredit>
  // Gives back what `use` took. A membership use has nothing to give back.
  restore(held: LockHeld, creditUse: CreditUse): Effect.Effect<void>
  balance(memberId: MemberId): Effect.Effect<MemberBalance, MemberNotFound>
  readonly listBalances: Effect.Effect<ReadonlyArray<MemberBalance>>
}>()("rollcall/contracts/Entitlements") {}
