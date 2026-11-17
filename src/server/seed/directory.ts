// Demo studio and members.
import { Member, MemberId } from "../../domain/Member.ts"
import { Studio, StudioId } from "../../domain/Studio.ts"
import type { DirectoryData } from "../contracts/Directory.ts"

export const demoStudio = new Studio({
  id: StudioId.make("northside"),
  name: "Northside Movement",
  rooms: ["Studio A", "Studio B"]
})

export const demoMembers = {
  ada: new Member({ id: MemberId.make("member-ada"), name: "Ada Okafor", email: "ada@example.com" }),
  bo: new Member({ id: MemberId.make("member-bo"), name: "Bo Lindqvist", email: "bo@example.com" }),
  chen: new Member({ id: MemberId.make("member-chen"), name: "Chen Wei", email: "chen@example.com" }),
  dara: new Member({ id: MemberId.make("member-dara"), name: "Dara Byrne", email: "dara@example.com" })
}

export const directorySeed: DirectoryData = {
  studio: demoStudio,
  members: Object.values(demoMembers)
}
