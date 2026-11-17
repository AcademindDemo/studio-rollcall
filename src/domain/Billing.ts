import { Schema } from "effect"
import { MemberId } from "./Member.ts"

const NonNegativeInt = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
const PositiveInt = Schema.Int.check(Schema.isGreaterThan(0))

export const ProductId = Schema.Literals(["pack-5", "pack-10", "monthly"])
export type ProductId = typeof ProductId.Type

export const ProductKind = Schema.Literals(["pack", "membership"])
export type ProductKind = typeof ProductKind.Type

// Prices are whole cents in EUR.
export class Product extends Schema.Class<Product>("Product")({
  id: ProductId,
  name: Schema.NonEmptyString,
  priceCents: PositiveInt,
  currency: Schema.Literal("EUR"),
  kind: ProductKind
}) {}

export const ClassPackId = Schema.NonEmptyString.pipe(Schema.brand("ClassPackId"))
export type ClassPackId = typeof ClassPackId.Type

export const MembershipId = Schema.NonEmptyString.pipe(Schema.brand("MembershipId"))
export type MembershipId = typeof MembershipId.Type

export const PurchaseId = Schema.NonEmptyString.pipe(Schema.brand("PurchaseId"))
export type PurchaseId = typeof PurchaseId.Type

// Opaque card reference the fake payment provider accepts. No card numbers are stored.
export const CardToken = Schema.NonEmptyString.pipe(Schema.brand("CardToken"))
export type CardToken = typeof CardToken.Type

// The payment provider's reference for a successful charge.
export const PaymentRef = Schema.NonEmptyString.pipe(Schema.brand("PaymentRef"))
export type PaymentRef = typeof PaymentRef.Type

export const PackSize = Schema.Literals([5, 10])
export type PackSize = typeof PackSize.Type

// A credit can pay for a class that starts before `expiresAt`.
export class ClassPack extends Schema.Class<ClassPack>("ClassPack")({
  id: ClassPackId,
  memberId: MemberId,
  size: PackSize,
  remaining: NonNegativeInt,
  purchasedAt: Schema.DateTimeUtc,
  expiresAt: Schema.DateTimeUtc
}) {}

export const RenewalState = Schema.Literals(["active", "failed"])
export type RenewalState = typeof RenewalState.Type

// Unlimited classes that start in [startsAt, endsAt). `cardToken` is charged on renewal.
export class Membership extends Schema.Class<Membership>("Membership")({
  id: MembershipId,
  memberId: MemberId,
  startsAt: Schema.DateTimeUtc,
  endsAt: Schema.DateTimeUtc,
  cardToken: CardToken,
  renewal: RenewalState
}) {}

export const PurchaseReason = Schema.Literals(["purchase", "renewal"])
export type PurchaseReason = typeof PurchaseReason.Type

export class Purchase extends Schema.Class<Purchase>("Purchase")({
  id: PurchaseId,
  memberId: MemberId,
  productId: ProductId,
  amountCents: PositiveInt,
  paymentRef: PaymentRef,
  at: Schema.DateTimeUtc,
  reason: PurchaseReason
}) {}

export const PurchaseInput = Schema.Struct({
  memberId: MemberId,
  productId: ProductId,
  cardToken: CardToken
})
export type PurchaseInput = typeof PurchaseInput.Type

// Expired packs don't count towards `packCreditsLeft`.
export class MemberBalance extends Schema.Class<MemberBalance>("MemberBalance")({
  memberId: MemberId,
  packCreditsLeft: NonNegativeInt,
  nextPackExpiry: Schema.optionalKey(Schema.DateTimeUtc),
  membershipEndsAt: Schema.optionalKey(Schema.DateTimeUtc),
  renewal: Schema.optionalKey(RenewalState)
}) {}
