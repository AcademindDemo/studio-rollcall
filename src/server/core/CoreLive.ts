// The real core every part builds on: the studio lock, the booking event bus and the
// seed-backed directory. A layer used in several places is built once per app, so a
// replacement layer may `Layer.provide(CoreLive)` itself and still share the same lock and bus.
import { Layer } from "effect"
import { BookingEvents } from "../contracts/BookingEvents.ts"
import { Directory } from "../contracts/Directory.ts"
import { StudioLock } from "../contracts/StudioLock.ts"
import { directorySeed } from "../Seed.ts"

export const CoreLive = Layer.mergeAll(
  StudioLock.layer,
  BookingEvents.layer,
  Directory.layer(directorySeed)
)
