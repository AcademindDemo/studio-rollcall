import { Context, Effect, Layer } from "effect"
import { MemberNotFound } from "../../domain/Errors.ts"
import type { Member, MemberId } from "../../domain/Member.ts"
import type { Studio } from "../../domain/Studio.ts"

export interface DirectoryData {
  readonly studio: Studio
  readonly members: ReadonlyArray<Member>
}

// Studio and member data. Read-only for now.
export class Directory extends Context.Service<Directory, {
  readonly studio: Effect.Effect<Studio>
  getMember(memberId: MemberId): Effect.Effect<Member, MemberNotFound>
  readonly listMembers: Effect.Effect<ReadonlyArray<Member>>
}>()("rollcall/contracts/Directory") {
  static readonly layer = (data: DirectoryData) =>
    Layer.succeed(Directory)(Directory.of({
      studio: Effect.succeed(data.studio),
      getMember: (memberId) => {
        const member = data.members.find((m) => m.id === memberId)
        return member === undefined ? Effect.fail(new MemberNotFound({ memberId })) : Effect.succeed(member)
      },
      listMembers: Effect.succeed(data.members)
    }))
}
