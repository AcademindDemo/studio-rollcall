import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup } from "effect/http-api"
import { ClassListing } from "../domain/ClassSession.ts"
import { Studio } from "../domain/Studio.ts"

export class ScheduleApi extends HttpApiGroup.make("studio").add(
  HttpApiEndpoint.get("get", "/studio", { success: Studio }),
  HttpApiEndpoint.get("listClasses", "/classes", { success: Schema.Array(ClassListing) })
) {}
