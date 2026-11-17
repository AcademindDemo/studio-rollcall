import { Schema } from "effect"
import { MemberBalance } from "./Billing.ts"
import { Booking } from "./Booking.ts"
import { ClassListing } from "./ClassSession.ts"
import { Member } from "./Member.ts"
import { WaitlistEntry } from "./Waitlist.ts"

// A class's bookings (with check-in state) and its waitlist in `joinedAt` order.
export class ClassRoster extends Schema.Class<ClassRoster>("ClassRoster")({
  classListing: ClassListing,
  bookings: Schema.Array(Booking),
  waitlist: Schema.Array(WaitlistEntry)
}) {}

// membershipEndingSoon: ends within 7 days without an active renewal.
// renewalFailed: the last renewal charge was declined.
// packExpiringSoon: a pack with credits left expires within 7 days.
export const MemberFlag = Schema.Literals(["membershipEndingSoon", "renewalFailed", "packExpiringSoon"])
export type MemberFlag = typeof MemberFlag.Type

// One row of the staff members list. The list is sorted with flagged memberships first,
// then expiring packs, then everyone else.
export class MemberOverview extends Schema.Class<MemberOverview>("MemberOverview")({
  member: Member,
  balance: MemberBalance,
  flags: Schema.Array(MemberFlag)
}) {}
