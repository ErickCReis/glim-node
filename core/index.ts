import "dotenv/config";

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { showRoutes } from "hono/dev";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { requestId } from "hono/request-id";
import type { GnModule } from "./gn-module.js";

export function start(modules: Array<GnModule>) {
  const app = new Hono({ strict: false });

  app.use("*", logger());
  app.use("*", prettyJSON());
  app.use("*", requestId());

  app.get("/im-alive", (c) => c.json(["ok"]));

  for (const module of modules) {
    // @ts-expect-error
    app.route("/", module._router);
  }

  showRoutes(app, { verbose: true, colorize: true });

  serve(
    {
      fetch: app.fetch,
      port: 3000,
    },
    (info) => {
      console.log(`Server is running on http://localhost:${info.port}`);
    }
  );
}
