import { DateTime } from "effect"
import { MemberBalance } from "../../domain/Billing.ts"
import type { Member } from "../../domain/Member.ts"
import { MemberOverview } from "../../domain/Staff.ts"
import type { MemberFlag } from "../../domain/Staff.ts"

const soonDays = 7

const flagsFor = (balance: MemberBalance, now: DateTime.Utc): ReadonlyArray<MemberFlag> => {
  const soon = DateTime.add(now, { days: soonDays })
  const flags: Array<MemberFlag> = []
  const endsAt = balance.membershipEndsAt
  if (endsAt !== undefined && balance.renewal !== "active" &&
    DateTime.isGreaterThan(endsAt, now) && DateTime.isLessThanOrEqualTo(endsAt, soon)) {
    flags.push("membershipEndingSoon")
  }
  if (balance.renewal === "failed") flags.push("renewalFailed")
  // nextPackExpiry only counts packs with credits left; an expired one is not "expiring soon".
  const expiry = balance.nextPackExpiry
  if (expiry !== undefined && DateTime.isGreaterThan(expiry, now) && DateTime.isLessThanOrEqualTo(expiry, soon)) {
    flags.push("packExpiringSoon")
  }
  return flags
}

// Memberships that need attention first, then packs running out, then everyone else.
// Within a group the earliest date comes first, then the name.
const rank = (row: MemberOverview): readonly [number, number] => {
  if (row.flags.includes("membershipEndingSoon") || row.flags.includes("renewalFailed")) {
    return [0, row.balance.membershipEndsAt?.epochMilliseconds ?? 0]
  }
  if (row.flags.includes("packExpiringSoon")) return [1, row.balance.nextPackExpiry?.epochMilliseconds ?? 0]
  return [2, 0]
}

export const memberOverviews = (
  members: ReadonlyArray<Member>,
  balances: ReadonlyArray<MemberBalance>,
  now: DateTime.Utc
): ReadonlyArray<MemberOverview> =>
  members.map((member) => {
    const balance = balances.find((b) => b.memberId === member.id) ?? new MemberBalance({ memberId: member.id, packCreditsLeft: 0 })
    return new MemberOverview({ member, balance, flags: flagsFor(balance, now) })
  }).sort((a, b) => {
    const [groupA, dateA] = rank(a)
    const [groupB, dateB] = rank(b)
    return groupA - groupB || dateA - dateB || a.member.name.localeCompare(b.member.name)
  })
