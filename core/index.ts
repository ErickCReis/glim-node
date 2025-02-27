import "dotenv/config";

import type { GnModule } from "@core/gn-module.js";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { showRoutes } from "hono/dev";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { requestId } from "hono/request-id";

export function start(modules: Array<GnModule>) {
  const app = new Hono({ strict: false });

  app.use("*", logger());
  app.use("*", prettyJSON());
  app.use("*", requestId());

  app.get("/im-alive", async (c) => {
    const info: Record<string, { status: "alive" | "dead"; latency: number }> =
      {};

    for (const m of modules) {
      const db = m.db;
      if (db) {
        info[`db.${m.namespace}`] = await check(() =>
          db
            .execute("SELECT 1")
            .then((r) => r.rowCount === 1)
            .catch(() => false),
        );
      }
    }

    return c.json(info);
  });

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
    },
  );
}

async function check(fn: () => Promise<boolean> | boolean) {
  const startTime = process.hrtime();
  const success = await fn();
  const elapsedSeconds = process.hrtime(startTime)[1] / 1_000_000;
  return {
    status: success ? ("alive" as const) : ("dead" as const),
    latency: elapsedSeconds,
  };
}
