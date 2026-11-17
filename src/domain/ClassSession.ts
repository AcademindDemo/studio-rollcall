import { Schema } from "effect"
import { WeeklyClassId } from "./Schedule.ts"
import { StudioId } from "./Studio.ts"

export const ClassId = Schema.NonEmptyString.pipe(Schema.brand("ClassId"))
export type ClassId = typeof ClassId.Type

const PositiveInt = Schema.Int.check(Schema.isGreaterThan(0))
const NonNegativeInt = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))

// One scheduled occurrence of a class: a specific start time, room and instructor.
// `weeklyClassId` is set when the session was expanded from a WeeklyClass template.
export class ClassSession extends Schema.Class<ClassSession>("ClassSession")({
  id: ClassId,
  studioId: StudioId,
  title: Schema.NonEmptyString,
  startsAt: Schema.DateTimeUtc,
  durationMinutes: PositiveInt,
  room: Schema.NonEmptyString,
  instructor: Schema.NonEmptyString,
  capacity: PositiveInt,
  weeklyClassId: Schema.optionalKey(WeeklyClassId)
}) {}

// What members see in the weekly schedule. `walkInHolds` are spots freed 2 h or less before
// start and kept for walk-ins; `spotsLeft` is capacity minus active bookings minus walk-in holds.
export class ClassListing extends Schema.Class<ClassListing>("ClassListing")({
  ...ClassSession.fields,
  walkInHolds: NonNegativeInt,
  spotsLeft: NonNegativeInt
}) {}
