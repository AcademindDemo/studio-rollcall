import { Context } from "effect"
import type { Effect } from "effect"
import type { Product, Purchase, PurchaseInput } from "../../domain/Billing.ts"
import type { AlreadyMember, MemberNotFound, PaymentDeclined, ProductNotFound } from "../../domain/Errors.ts"

export class Billing extends Context.Service<Billing, {
  readonly products: Effect.Effect<ReadonlyArray<Product>>
  // Charges first, outside the lock, then commits the pack or membership and the purchase under StudioLock.
  purchase(input: PurchaseInput): Effect.Effect<Purchase, MemberNotFound | ProductNotFound | PaymentDeclined | AlreadyMember>
  // One renewal pass, also run every minute by a schedule. Returns the renewal purchases it made.
  readonly renewDue: Effect.Effect<ReadonlyArray<Purchase>>
}>()("rollcall/contracts/Billing") {}
