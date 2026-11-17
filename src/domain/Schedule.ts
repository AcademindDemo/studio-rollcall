import { Schema } from "effect"

const PositiveInt = Schema.Int.check(Schema.isGreaterThan(0))

export const WeeklyClassId = Schema.NonEmptyString.pipe(Schema.brand("WeeklyClassId"))
export type WeeklyClassId = typeof WeeklyClassId.Type

export const Weekday = Schema.Literals(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"])
export type Weekday = typeof Weekday.Type

// Start time of day in UTC, "HH:MM" (24 h).
export const StartTime = Schema.String.check(Schema.isPattern(/^([01]\d|2[0-3]):[0-5]\d$/))
export type StartTime = typeof StartTime.Type

const weeklyClassFields = {
  title: Schema.NonEmptyString,
  weekday: Weekday,
  startTime: StartTime,
  durationMinutes: PositiveInt,
  room: Schema.NonEmptyString,
  instructor: Schema.NonEmptyString,
  capacity: PositiveInt
}

// A weekly template; the schedule expands it into one ClassSession per week.
export class WeeklyClass extends Schema.Class<WeeklyClass>("WeeklyClass")({
  id: WeeklyClassId,
  ...weeklyClassFields
}) {}

export const AddWeeklyClassInput = Schema.Struct(weeklyClassFields)
export type AddWeeklyClassInput = typeof AddWeeklyClassInput.Type
