import { DateTime, Effect, Layer, Ref } from "effect"
import { ClassId, ClassSession } from "../../domain/ClassSession.ts"
import { ClassNotFound, InvalidWeeklyClass } from "../../domain/Errors.ts"
import { WeeklyClass, WeeklyClassId } from "../../domain/Schedule.ts"
import type { Weekday } from "../../domain/Schedule.ts"
import { Directory } from "../contracts/Directory.ts"
import { Schedule } from "../contracts/Schedule.ts"
import { StudioLock } from "../contracts/StudioLock.ts"
import { scheduleSeed } from "../seed/schedule.ts"

const weekdays: ReadonlyArray<Weekday> = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]

export const ScheduleLive = Layer.effect(Schedule, Effect.gen(function*() {
  const directory = yield* Directory
  const studio = yield* directory.studio
  const lock = yield* StudioLock
  const firstDay = DateTime.add(DateTime.startOf(yield* DateTime.now, "day"), { days: 1 })
  const initial = scheduleSeed(firstDay)
  const templates = yield* Ref.make(initial.weeklyClasses)
  // Keep past occurrences addressable for cancellations, rosters and reminders.
  const sessions = yield* Ref.make(initial.classes)
  const listWeek = Effect.gen(function*() {
    const today = DateTime.startOf(yield* DateTime.now, "day")
    const start = today.epochMilliseconds > firstDay.epochMilliseconds ? today : firstDay
    const weekly = yield* Ref.get(templates)
    return yield* Ref.modify(sessions, (existing) => {
      const week = Array.from({ length: 7 }, (_, day) => {
        const date = DateTime.add(start, { days: day })
        return weekly.filter((w) => w.weekday === weekdays[DateTime.getPartUtc(date, "weekDay")]).map((w) => {
          const parts = w.startTime.split(":")
          const startsAt = DateTime.add(date, { hours: Number(parts[0]), minutes: Number(parts[1]) })
          return existing.find((s) => s.weeklyClassId === w.id && s.startsAt.epochMilliseconds === startsAt.epochMilliseconds) ??
            new ClassSession({
              id: ClassId.make(`${w.id}-${DateTime.formatIsoDateUtc(date)}`), weeklyClassId: w.id, studioId: studio.id, startsAt,
              title: w.title, durationMinutes: w.durationMinutes, room: w.room, instructor: w.instructor, capacity: w.capacity
            })
        })
      }).flat().sort((a, b) => a.startsAt.epochMilliseconds - b.startsAt.epochMilliseconds)
      const added = week.filter((s) => !existing.some((e) => e.id === s.id))
      return [week, [...existing, ...added]]
    })
  })
  return Schedule.of({
    listWeek,
    getClass: (classId) => Effect.gen(function*() {
      yield* listWeek
      const found = (yield* Ref.get(sessions)).find((s) => s.id === classId)
      return found === undefined ? yield* new ClassNotFound({ classId }) : found
    }),
    listWeeklyClasses: Ref.get(templates),
    addWeeklyClass: (input) => lock.withLock(() => Effect.gen(function*() {
      if (!studio.rooms.includes(input.room)) return yield* new InvalidWeeklyClass({ reason: "Unknown studio room" })
      const current = yield* Ref.get(templates)
      const weekly = new WeeklyClass({ ...input, id: WeeklyClassId.make(`weekly-added-${current.length + 1}`) })
      yield* Ref.set(templates, [...current, weekly])
      return weekly
    }))
  })
}))
