import { Schema } from "effect"
import { ClassId } from "./ClassSession.ts"
import { MemberId } from "./Member.ts"

export const WaitlistEntryId = Schema.NonEmptyString.pipe(Schema.brand("WaitlistEntryId"))
export type WaitlistEntryId = typeof WaitlistEntryId.Type

export const WaitlistStatus = Schema.Literals(["waiting", "promoted", "skipped", "left"])
export type WaitlistStatus = typeof WaitlistStatus.Type

export class WaitlistEntry extends Schema.Class<WaitlistEntry>("WaitlistEntry")({
  id: WaitlistEntryId,
  classId: ClassId,
  memberId: MemberId,
  joinedAt: Schema.DateTimeUtc,
  status: WaitlistStatus
}) {}

export const JoinWaitlistInput = Schema.Struct({
  classId: ClassId,
  memberId: MemberId
})
export type JoinWaitlistInput = typeof JoinWaitlistInput.Type

export const LeaveWaitlistInput = Schema.Struct({
  classId: ClassId,
  memberId: MemberId
})
export type LeaveWaitlistInput = typeof LeaveWaitlistInput.Type
