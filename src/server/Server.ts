import { Layer } from "effect"
import { HttpRouter } from "effect/http"
import { HttpApiBuilder } from "effect/http-api"
import { Api } from "../api/Api.ts"
import { HandlersLive } from "./Handlers.ts"
import { Store } from "./Store.ts"

// All routes, with an in-memory demo store. Needs an HttpServer (see src/main.ts and the e2e test).
export const ServerLive = HttpRouter.serve(
  HttpApiBuilder.layer(Api, { openapiPath: "/openapi.json" }).pipe(Layer.provide(HandlersLive))
).pipe(Layer.provide(Store.layerDemo))
