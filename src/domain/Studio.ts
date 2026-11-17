import { Schema } from "effect"

export const StudioId = Schema.NonEmptyString.pipe(Schema.brand("StudioId"))
export type StudioId = typeof StudioId.Type

export class Studio extends Schema.Class<Studio>("Studio")({
  id: StudioId,
  name: Schema.NonEmptyString,
  rooms: Schema.Array(Schema.NonEmptyString)
}) {}
