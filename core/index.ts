import "dotenv/config";

import { type GnModule, appEnv } from "@core/gn-module.js";
import { corsMiddleware } from "@core/middleware/cors-middleware.js";
import { loggerMiddleware } from "@core/middleware/logger-middleware.js";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { showRoutes } from "hono/dev";
import { requestId } from "hono/request-id";

export function start(modules: Array<GnModule>) {
  const app = new Hono({ strict: false });

  app.use("*", requestId({ headerName: "trace-id" }));
  app.use("*", loggerMiddleware);
  app.use("*", corsMiddleware);

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

    const someIsDead = Object.values(info).some((i) => i.status === "dead");
    return c.json(info, someIsDead ? 500 : 200);
  });

  for (const module of modules) {
    app.route("/", module._router);
  }

  if (appEnv.APP_ENV === "DEV") {
    showRoutes(app, { verbose: true });
  }

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
