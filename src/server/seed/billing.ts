import { DateTime } from "effect"
import { CardToken, ClassPack, ClassPackId, Membership, MembershipId, Product } from "../../domain/Billing.ts"
import { demoMembers } from "./directory.ts"

export const products: ReadonlyArray<Product> = [
  new Product({ id: "pack-5", name: "5-class pack", priceCents: 6500, currency: "EUR", kind: "pack" }),
  new Product({ id: "pack-10", name: "10-class pack", priceCents: 12000, currency: "EUR", kind: "pack" }),
  new Product({ id: "monthly", name: "Monthly membership", priceCents: 8900, currency: "EUR", kind: "membership" })
]

export const billingSeed = (now: DateTime.Utc) => ({
  packs: [
    new ClassPack({ id: ClassPackId.make("seed-bo"), memberId: demoMembers.bo.id, size: 10, remaining: 10,
      purchasedAt: now, expiresAt: DateTime.add(now, { months: 3 }) }),
    new ClassPack({ id: ClassPackId.make("seed-dara"), memberId: demoMembers.dara.id, size: 5, remaining: 1,
      purchasedAt: now, expiresAt: DateTime.add(now, { months: 3 }) })
  ],
  memberships: [new Membership({ id: MembershipId.make("seed-ada"), memberId: demoMembers.ada.id,
    startsAt: now, endsAt: DateTime.add(now, { days: 30 }), cardToken: CardToken.make("seed-card"), renewal: "active" })]
})
