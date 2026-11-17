import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"
import { MemberBalance, Product, Purchase, PurchaseInput } from "../domain/Billing.ts"
import { AlreadyMember, MemberNotFound, PaymentDeclined, ProductNotFound } from "../domain/Errors.ts"
import { MemberId } from "../domain/Member.ts"

export class BillingApi extends HttpApiGroup.make("billing").add(
  HttpApiEndpoint.get("products", "/products", { success: Schema.Array(Product) }),
  HttpApiEndpoint.post("purchase", "/purchases", { payload: PurchaseInput,
    success: Purchase.pipe(HttpApiSchema.status(201)), error: [MemberNotFound, ProductNotFound, PaymentDeclined, AlreadyMember] }),
  HttpApiEndpoint.get("balance", "/members/:id/balance", { params: { id: MemberId }, success: MemberBalance, error: MemberNotFound })
) {}
