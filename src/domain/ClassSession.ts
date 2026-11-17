import { Schema } from "effect"
import { StudioId } from "./Studio.ts"

export const ClassId = Schema.NonEmptyString.pipe(Schema.brand("ClassId"))
export type ClassId = typeof ClassId.Type

const PositiveInt = Schema.Int.check(Schema.isGreaterThan(0))

// One scheduled occurrence of a class: a specific start time, room and instructor.
export class ClassSession extends Schema.Class<ClassSession>("ClassSession")({
  id: ClassId,
  studioId: StudioId,
  title: Schema.NonEmptyString,
  startsAt: Schema.DateTimeUtc,
  durationMinutes: PositiveInt,
  room: Schema.NonEmptyString,
  instructor: Schema.NonEmptyString,
  capacity: PositiveInt
}) {}

// What members see in the weekly schedule.
export class ClassListing extends Schema.Class<ClassListing>("ClassListing")({
  ...ClassSession.fields,
  spotsLeft: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
}) {}
