import { Schema } from "effect"

export const MemberId = Schema.NonEmptyString.pipe(Schema.brand("MemberId"))
export type MemberId = typeof MemberId.Type

export class Member extends Schema.Class<Member>("Member")({
  id: MemberId,
  name: Schema.NonEmptyString,
  email: Schema.NonEmptyString
}) {}
