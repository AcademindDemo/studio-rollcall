import { Context } from "effect"
import type { Effect } from "effect"
import type { ClassId } from "../../domain/ClassSession.ts"
import type {
  AlreadyBooked,
  AlreadyWaitlisted,
  ClassNotFound,
  ClassNotFull,
  ClassStarted,
  MemberNotFound,
  NotOnWaitlist
} from "../../domain/Errors.ts"
import type { MemberId } from "../../domain/Member.ts"
import type { JoinWaitlistInput, LeaveWaitlistInput, WaitlistEntry } from "../../domain/Waitlist.ts"

export class Waitlist extends Context.Service<Waitlist, {
  // Commands: each takes StudioLock.
  join(
    input: JoinWaitlistInput
  ): Effect.Effect<
    WaitlistEntry,
    ClassNotFound | MemberNotFound | ClassStarted | ClassNotFull | AlreadyBooked | AlreadyWaitlisted
  >
  leave(input: LeaveWaitlistInput): Effect.Effect<WaitlistEntry, NotOnWaitlist>
  // Reads, in `joinedAt` order.
  forClass(classId: ClassId): Effect.Effect<ReadonlyArray<WaitlistEntry>, ClassNotFound>
  forMember(memberId: MemberId): Effect.Effect<ReadonlyArray<WaitlistEntry>, MemberNotFound>
}>()("rollcall/contracts/Waitlist") {}
