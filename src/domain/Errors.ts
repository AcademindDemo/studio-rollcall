import { Schema } from "effect"
import { ClassId } from "./ClassSession.ts"
import { MemberId } from "./Member.ts"

export class ClassNotFound extends Schema.TaggedError<ClassNotFound>()(
  "ClassNotFound",
  { classId: ClassId },
  { httpApiStatus: 404 }
) {}

export class MemberNotFound extends Schema.TaggedError<MemberNotFound>()(
  "MemberNotFound",
  { memberId: MemberId },
  { httpApiStatus: 404 }
) {}

export class ClassFull extends Schema.TaggedError<ClassFull>()(
  "ClassFull",
  { classId: ClassId },
  { httpApiStatus: 409 }
) {}

export class AlreadyBooked extends Schema.TaggedError<AlreadyBooked>()(
  "AlreadyBooked",
  { classId: ClassId, memberId: MemberId },
  { httpApiStatus: 409 }
) {}
