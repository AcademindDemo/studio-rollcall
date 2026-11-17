// Demo week: three classes a day for seven days starting at `weekStart`, and the bookings
// that make day 1's HIIT class full.
import { DateTime } from "effect"
import { MembershipId } from "../../domain/Billing.ts"
import { Booking, BookingId } from "../../domain/Booking.ts"
import { ClassId, ClassSession } from "../../domain/ClassSession.ts"
import { WeeklyClass, WeeklyClassId } from "../../domain/Schedule.ts"
import type { Weekday } from "../../domain/Schedule.ts"
import { demoMembers, demoStudio } from "./directory.ts"

export interface ScheduleSeed {
  readonly weeklyClasses: ReadonlyArray<WeeklyClass>
  readonly classes: ReadonlyArray<ClassSession>
  readonly bookings: ReadonlyArray<Booking>
}

interface Slot {
  readonly title: string
  readonly hour: number
  readonly durationMinutes: number
  readonly room: string
  readonly instructor: string
  readonly capacity: number
}

const weekdays: ReadonlyArray<Weekday> = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]

const dailySlots: ReadonlyArray<Slot> = [
  { title: "Morning Flow Yoga", hour: 7, durationMinutes: 60, room: "Studio A", instructor: "Maya", capacity: 12 },
  { title: "Contemporary Dance", hour: 12, durationMinutes: 75, room: "Studio B", instructor: "Luis", capacity: 10 },
  { title: "Evening HIIT", hour: 18, durationMinutes: 45, room: "Studio A", instructor: "Sam", capacity: 2 }
]

export const scheduleSeed = (weekStart: DateTime.Utc): ScheduleSeed => {
  const weeklyClasses = Array.from({ length: 7 }, (_, day) =>
    dailySlots.map((slot, index) => new WeeklyClass({
      id: WeeklyClassId.make(`weekly-d${day + 1}-${index + 1}`),
      title: slot.title,
      weekday: weekdays[DateTime.getPartUtc(DateTime.add(weekStart, { days: day }), "weekDay")] ?? "sunday",
      startTime: `${String(slot.hour).padStart(2, "0")}:00`,
      durationMinutes: slot.durationMinutes, room: slot.room, instructor: slot.instructor, capacity: slot.capacity
    }))
  ).flat()
  const classes = Array.from({ length: 7 }, (_, day) =>
    dailySlots.map((slot, index) =>
      new ClassSession({
        id: ClassId.make(`class-d${day + 1}-${index + 1}`),
        weeklyClassId: WeeklyClassId.make(`weekly-d${day + 1}-${index + 1}`),
        studioId: demoStudio.id,
        title: slot.title,
        startsAt: DateTime.add(weekStart, { days: day, hours: slot.hour }),
        durationMinutes: slot.durationMinutes,
        room: slot.room,
        instructor: slot.instructor,
        capacity: slot.capacity
      })
    )).flat()

  // Day 1's HIIT class starts full, so the "class is full" path has data behind it.
  const bookings = [demoMembers.bo, demoMembers.chen].map((member, index) =>
    new Booking({
      id: BookingId.make(`booking-seed-${index + 1}`),
      classId: ClassId.make("class-d1-3"),
      memberId: member.id,
      bookedAt: weekStart,
      source: "member",
      status: "booked",
      creditUse: { _tag: "Membership", membershipId: MembershipId.make("seed") }
    })
  )

  return { weeklyClasses, classes, bookings }
}
