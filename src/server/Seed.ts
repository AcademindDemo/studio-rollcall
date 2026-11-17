// Demo data: one studio, a week of classes starting at `weekStart`, a few members and bookings.
import { DateTime } from "effect"
import { Booking, BookingId } from "../domain/Booking.ts"
import { ClassId, ClassSession } from "../domain/ClassSession.ts"
import { Member, MemberId } from "../domain/Member.ts"
import { Studio, StudioId } from "../domain/Studio.ts"

export interface SeedData {
  readonly studio: Studio
  readonly members: ReadonlyArray<Member>
  readonly classes: ReadonlyArray<ClassSession>
  readonly bookings: ReadonlyArray<Booking>
}

const studio = new Studio({
  id: StudioId.make("northside"),
  name: "Northside Movement",
  rooms: ["Studio A", "Studio B"]
})

export const demoMembers = {
  ada: new Member({ id: MemberId.make("member-ada"), name: "Ada Okafor", email: "ada@example.com" }),
  bo: new Member({ id: MemberId.make("member-bo"), name: "Bo Lindqvist", email: "bo@example.com" }),
  chen: new Member({ id: MemberId.make("member-chen"), name: "Chen Wei", email: "chen@example.com" }),
  dara: new Member({ id: MemberId.make("member-dara"), name: "Dara Byrne", email: "dara@example.com" })
}

interface Slot {
  readonly title: string
  readonly hour: number
  readonly durationMinutes: number
  readonly room: string
  readonly instructor: string
  readonly capacity: number
}

const dailySlots: ReadonlyArray<Slot> = [
  { title: "Morning Flow Yoga", hour: 7, durationMinutes: 60, room: "Studio A", instructor: "Maya", capacity: 12 },
  { title: "Contemporary Dance", hour: 12, durationMinutes: 75, room: "Studio B", instructor: "Luis", capacity: 10 },
  { title: "Evening HIIT", hour: 18, durationMinutes: 45, room: "Studio A", instructor: "Sam", capacity: 2 }
]

export const seed = (weekStart: DateTime.Utc): SeedData => {
  const classes = Array.from({ length: 7 }, (_, day) =>
    dailySlots.map((slot, index) =>
      new ClassSession({
        id: ClassId.make(`class-d${day + 1}-${index + 1}`),
        studioId: studio.id,
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
      bookedAt: weekStart
    })
  )

  return { studio, members: Object.values(demoMembers), classes, bookings }
}
