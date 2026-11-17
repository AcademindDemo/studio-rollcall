// The HTTP contract, shared by the server and typed clients. Keep server code out of src/api.
import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"
import { BookClassInput, Booking } from "../domain/Booking.ts"
import { ClassListing } from "../domain/ClassSession.ts"
import { AlreadyBooked, ClassFull, ClassNotFound, MemberNotFound } from "../domain/Errors.ts"
import { Studio } from "../domain/Studio.ts"

export class SystemApi extends HttpApiGroup.make("system", { topLevel: true }).add(
  HttpApiEndpoint.get("health", "/health", { success: HttpApiSchema.NoContent })
) {}

export class StudioApi extends HttpApiGroup.make("studio").add(
  HttpApiEndpoint.get("get", "/studio", { success: Studio }),
  HttpApiEndpoint.get("listClasses", "/classes", { success: Schema.Array(ClassListing) })
) {}

export class BookingsApi extends HttpApiGroup.make("bookings").add(
  HttpApiEndpoint.post("book", "/bookings", {
    payload: BookClassInput,
    success: Booking.pipe(HttpApiSchema.status(201)),
    error: [ClassNotFound, MemberNotFound, ClassFull, AlreadyBooked]
  })
) {}

export class Api extends HttpApi.make("studio-rollcall")
  .add(SystemApi)
  .add(StudioApi)
  .add(BookingsApi)
{}
