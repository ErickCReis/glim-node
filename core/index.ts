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
    const router = module.router;

    if (router.v1) {
      app.route("/", router.v1);
    }

    if (router.v2) {
      app.route("/", router.v2);
    }

    if (router.v3) {
      app.route("/", router.v3);
    }

    for (const middleware of module.middleware) {
      app.use(`/${module.namespace}/*`, middleware);
    }
  }

  showRoutes(app, { verbose: true, colorize: true });

  serve(
    {
      fetch: app.fetch,
      port: 3000,
    },
    (info) => {
      console.log(`Server is running on http://localhost:${info.port}`);
    },
  );
}
