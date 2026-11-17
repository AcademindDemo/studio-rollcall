import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"
import { Booking, BookingId } from "../domain/Booking.ts"
import { ClassId, ClassListing } from "../domain/ClassSession.ts"
import { AlreadyCheckedIn, BookingNotActive, BookingNotFound, ClassNotFound, InvalidWeeklyClass } from "../domain/Errors.ts"
import { AddWeeklyClassInput, WeeklyClass } from "../domain/Schedule.ts"
import { ClassRoster, MemberOverview } from "../domain/Staff.ts"

// The staff dashboard's JSON API. The page at GET /staff/ calls only these endpoints.
export class StaffApi extends HttpApiGroup.make("staff").add(
  HttpApiEndpoint.post("addWeeklyClass", "/staff/weekly-classes", {
    payload: AddWeeklyClassInput,
    success: WeeklyClass.pipe(HttpApiSchema.status(201)),
    error: InvalidWeeklyClass
  }),
  HttpApiEndpoint.get("listWeeklyClasses", "/staff/weekly-classes", { success: Schema.Array(WeeklyClass) }),
  // The week's classes, as GET /classes serves them, so the page can pick a class by id.
  HttpApiEndpoint.get("listClasses", "/staff/classes", { success: Schema.Array(ClassListing) }),
  HttpApiEndpoint.get("roster", "/staff/classes/:id/roster", { params: { id: ClassId }, success: ClassRoster, error: ClassNotFound }),
  HttpApiEndpoint.post("checkIn", "/staff/bookings/:id/check-in", {
    params: { id: BookingId },
    success: Booking,
    error: [BookingNotFound, BookingNotActive, AlreadyCheckedIn]
  }),
  HttpApiEndpoint.get("members", "/staff/members", { success: Schema.Array(MemberOverview) })
) {}
