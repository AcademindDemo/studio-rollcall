import { Context } from "effect"
import type { Effect } from "effect"
import type { OutboxEmail, OutboxFilter } from "../../domain/Email.ts"
import type { BookingEvent } from "../../domain/Events.ts"

// Local outbox: emails are written here and never sent.
export class Outbox extends Context.Service<Outbox, {
  list(filter?: OutboxFilter): Effect.Effect<ReadonlyArray<OutboxEmail>>
  // The event subscriber's step: writes the emails one BookingEvent causes and returns them.
  // Tests call it directly instead of waiting for the subscriber fiber.
  onEvent(event: BookingEvent): Effect.Effect<ReadonlyArray<OutboxEmail>>
  // One reminder pass, also run every minute by a schedule. Returns the reminders it wrote.
  readonly sweepReminders: Effect.Effect<ReadonlyArray<OutboxEmail>>
}>()("rollcall/contracts/Outbox") {}
