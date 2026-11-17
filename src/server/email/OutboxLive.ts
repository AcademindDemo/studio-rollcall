// In-memory outbox. Emails are written here and never sent: no network and no SMTP.
import { DateTime, Effect, Layer, Option, PubSub, Ref, Schedule } from "effect"
import type { BookingId } from "../../domain/Booking.ts"
import type { ClassSession } from "../../domain/ClassSession.ts"
import { OutboxEmail, OutboxEmailId, type EmailKind, type OutboxFilter } from "../../domain/Email.ts"
import type { BookingEvent } from "../../domain/Events.ts"
import { BookingEvents } from "../contracts/BookingEvents.ts"
import { Bookings } from "../contracts/Bookings.ts"
import { Directory } from "../contracts/Directory.ts"
import { Outbox } from "../contracts/Outbox.ts"
import { Schedule as ClassSchedule } from "../contracts/Schedule.ts"
import { StudioLock } from "../contracts/StudioLock.ts"
import { CoreLive } from "../core/CoreLive.ts"

interface Mailbox {
  readonly emails: ReadonlyArray<OutboxEmail>
  readonly nextId: number
}

interface Draft {
  readonly kind: EmailKind
  readonly to: OutboxEmail["to"]
  readonly subject: OutboxEmail["subject"]
  readonly body: string
  readonly bookingId: BookingId
}

// What the member needs in order to show up. A late waitlist promotion misses the
// day-before reminder, so that email carries the same details.
const classDetails = (session: ClassSession): string =>
  [
    session.title,
    `Starts: ${DateTime.formatIso(session.startsAt)}`,
    `Room: ${session.room}`,
    `Instructor: ${session.instructor}`,
    `Duration: ${session.durationMinutes} minutes`
  ].join("\n")

const matches = (email: OutboxEmail, filter: OutboxFilter | undefined): boolean =>
  (filter?.kind === undefined || email.kind === filter.kind) &&
  (filter?.to === undefined || email.to === filter.to) &&
  (filter?.bookingId === undefined || email.bookingId === filter.bookingId)

const make = Effect.gen(function*() {
  const bookings = yield* Bookings
  const schedule = yield* ClassSchedule
  const directory = yield* Directory
  const events = yield* BookingEvents
  const lock = yield* StudioLock
  const state = yield* Ref.make<Mailbox>({ emails: [], nextId: 1 })

  // One booking gets one email of a given kind. The check and the write share one
  // Ref update, so overlapping sweeps cannot double-send.
  const write = (drafts: ReadonlyArray<Draft>, createdAt: DateTime.Utc) =>
    Ref.modify(state, (current) => {
      const written: Array<OutboxEmail> = []
      const emails = [...current.emails]
      let nextId = current.nextId
      for (const draft of drafts) {
        if (emails.some((email) => email.kind === draft.kind && email.bookingId === draft.bookingId)) {
          continue
        }
        const email = new OutboxEmail({
          id: OutboxEmailId.make(`email-${nextId}`),
          kind: draft.kind,
          to: draft.to,
          subject: draft.subject,
          body: draft.body,
          bookingId: draft.bookingId,
          createdAt
        })
        nextId = nextId + 1
        emails.push(email)
        written.push(email)
      }
      return [written, { emails, nextId }]
    })

  const onEvent = Effect.fn("Outbox.onEvent")(function*(event: BookingEvent) {
    if (event._tag !== "BookingConfirmed") {
      return []
    }
    const member = yield* directory.getMember(event.booking.memberId).pipe(Effect.option)
    if (Option.isNone(member)) {
      yield* Effect.logWarning(`Outbox skipped booking ${event.booking.id}: member not found`)
      return []
    }
    const session = yield* schedule.getClass(event.booking.classId).pipe(Effect.option)
    const kind: EmailKind = event.booking.source === "waitlist" ? "WaitlistPromoted" : "BookingConfirmed"
    const title = Option.isSome(session) ? session.value.title : "your class"
    const details = Option.isSome(session) ? classDetails(session.value) : `Class: ${event.booking.classId}`
    const intro = kind === "WaitlistPromoted"
      ? "A spot opened up and you are booked."
      : "Your booking is confirmed."
    const subjectLead = kind === "WaitlistPromoted" ? "A spot opened" : "Booking confirmed"
    return yield* write([{
      kind,
      to: member.value.email,
      subject: `${subjectLead}: ${title}`,
      body: `${intro}\n\n${details}`,
      bookingId: event.booking.id
    }], yield* DateTime.now)
  })

  // `upcoming` is [from, to). A class exactly 24 h away is due, so the end is 1 ms later.
  // The read and the write share the studio lock with cancel, so a booking cancelled
  // before this pass is not reminded.
  const sweepReminders = Effect.gen(function*() {
    const now = yield* DateTime.now
    const horizon = DateTime.add(now, { hours: 24, milliseconds: 1 })
    return yield* lock.withLock(() => Effect.gen(function*() {
      const due = yield* bookings.upcoming(now, horizon)
      const drafts: Array<Draft> = []
      for (const item of due) {
        if (item.booking.status !== "booked") {
          continue
        }
        const member = yield* directory.getMember(item.booking.memberId).pipe(Effect.option)
        if (Option.isNone(member)) {
          continue
        }
        const session = item.classSession
        drafts.push({
          kind: "ClassReminder",
          to: member.value.email,
          subject: `Class reminder: ${session.title}`,
          body: `Your class starts within 24 hours.\n\n${classDetails(session)}`,
          bookingId: item.booking.id
        })
      }
      return yield* write(drafts, now)
    }))
  })

  const list = (filter?: OutboxFilter) =>
    Ref.get(state).pipe(Effect.map((current) => current.emails.filter((email) => matches(email, filter))))

  // Subscribe while the layer is built, before the server accepts requests.
  const subscription = yield* events.subscribe
  yield* PubSub.take(subscription).pipe(
    Effect.flatMap((event) => onEvent(event)),
    Effect.forever,
    Effect.forkScoped
  )

  yield* sweepReminders.pipe(
    Effect.repeat(Schedule.fixed("1 minute")),
    Effect.forkScoped
  )

  return Outbox.of({ list, onEvent, sweepReminders })
})

// CoreLive is built once per app, so this shares the bus the bookings publish on.
export const OutboxLive = Layer.effect(Outbox, make).pipe(Layer.provide(CoreLive))
