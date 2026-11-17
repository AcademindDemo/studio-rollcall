import { DateTime, Effect, Layer } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { Api } from "../../api/Api.ts"
import { ClassRoster } from "../../domain/Staff.ts"
import { Bookings } from "../contracts/Bookings.ts"
import { Directory } from "../contracts/Directory.ts"
import { Entitlements } from "../contracts/Entitlements.ts"
import { Schedule } from "../contracts/Schedule.ts"
import { Waitlist } from "../contracts/Waitlist.ts"
import { WaitlistLive } from "../waitlist/WaitlistLive.ts"
import { memberOverviews } from "./Members.ts"

// Holds no state: every endpoint composes the other parts' services.
// WaitlistLive is provided here too so a stack that reuses HandlersLive gains no new open
// requirement; one app build memoizes one instance.
export const StaffHandlersLive = HttpApiBuilder.group(Api, "staff", Effect.fn(function*(handlers) {
  const schedule = yield* Schedule
  const bookings = yield* Bookings
  const waitlist = yield* Waitlist
  const directory = yield* Directory
  const entitlements = yield* Entitlements
  return handlers
    .handle("addWeeklyClass", ({ payload }) => schedule.addWeeklyClass(payload))
    .handle("listWeeklyClasses", () => schedule.listWeeklyClasses)
    .handle("listClasses", () => bookings.listWeek)
    .handle("roster", ({ params }) => Effect.gen(function*() {
      const classListing = yield* bookings.listing(params.id)
      const roster = yield* bookings.roster(params.id)
      const queue = yield* waitlist.forClass(params.id)
      return new ClassRoster({ classListing, bookings: roster, waitlist: queue })
    }))
    .handle("checkIn", ({ params }) => bookings.checkIn({ bookingId: params.id }))
    .handle("members", () => Effect.gen(function*() {
      const members = yield* directory.listMembers
      const balances = yield* entitlements.listBalances
      return memberOverviews(members, balances, yield* DateTime.now)
    }))
})).pipe(Layer.provide(WaitlistLive))
