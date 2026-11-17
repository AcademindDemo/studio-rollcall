import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { Config, Layer } from "effect"
import { createServer } from "node:http"
import { ServerLive } from "./server/Server.ts"

// PORT is required: every agent runs its own copy of the app on its own port.
const HttpServerLive = NodeHttpServer.layerConfig(createServer, { port: Config.Port("PORT") })

Layer.launch(ServerLive.pipe(Layer.provide(HttpServerLive))).pipe(NodeRuntime.runMain)
