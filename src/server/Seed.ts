// Demo data, composed from the slices in ./seed: one studio, a few members, and a week of
// classes and bookings starting at `weekStart`.
import type { DateTime } from "effect"
import type { DirectoryData } from "./contracts/Directory.ts"
import { directorySeed } from "./seed/directory.ts"
import { scheduleSeed } from "./seed/schedule.ts"
import type { ScheduleSeed } from "./seed/schedule.ts"

export { demoMembers, demoStudio, directorySeed } from "./seed/directory.ts"

export interface SeedData extends DirectoryData, ScheduleSeed {}

export const seed = (weekStart: DateTime.Utc): SeedData => ({
  ...directorySeed,
  ...scheduleSeed(weekStart)
})
