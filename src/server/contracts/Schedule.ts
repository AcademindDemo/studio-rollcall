import { Context } from "effect"
import type { Effect } from "effect"
import type { ClassId, ClassSession } from "../../domain/ClassSession.ts"
import type { ClassNotFound, InvalidWeeklyClass } from "../../domain/Errors.ts"
import type { AddWeeklyClassInput, WeeklyClass } from "../../domain/Schedule.ts"

// Weekly templates and the sessions they expand into for the coming week (UTC).
export class Schedule extends Context.Service<Schedule, {
  readonly listWeek: Effect.Effect<ReadonlyArray<ClassSession>>
  getClass(classId: ClassId): Effect.Effect<ClassSession, ClassNotFound>
  addWeeklyClass(input: AddWeeklyClassInput): Effect.Effect<WeeklyClass, InvalidWeeklyClass>
  readonly listWeeklyClasses: Effect.Effect<ReadonlyArray<WeeklyClass>>
}>()("rollcall/contracts/Schedule") {}
