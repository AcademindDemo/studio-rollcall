import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"
import { ClassId } from "../domain/ClassSession.ts"
import {
  AlreadyBooked,
  AlreadyWaitlisted,
  ClassNotFound,
  ClassNotFull,
  ClassStarted,
  MemberNotFound,
  NotOnWaitlist
} from "../domain/Errors.ts"
import { MemberId } from "../domain/Member.ts"
import { WaitlistEntry } from "../domain/Waitlist.ts"

export class WaitlistApi extends HttpApiGroup.make("waitlist").add(
  HttpApiEndpoint.post("join", "/classes/:id/waitlist", {
    params: { id: ClassId },
    payload: Schema.Struct({ memberId: MemberId }),
    success: WaitlistEntry.pipe(HttpApiSchema.status(201)),
    error: [ClassNotFound, MemberNotFound, ClassStarted, ClassNotFull, AlreadyBooked, AlreadyWaitlisted]
  }),
  HttpApiEndpoint.delete("leave", "/classes/:id/waitlist/:memberId", {
    params: { id: ClassId, memberId: MemberId },
    success: WaitlistEntry,
    error: NotOnWaitlist
  }),
  HttpApiEndpoint.get("forMember", "/members/:id/waitlists", {
    params: { id: MemberId },
    success: Schema.Array(WaitlistEntry),
    error: MemberNotFound
  })
) {}
