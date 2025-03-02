import "dotenv/config";

import { type GnModule, mainEnv } from "@core/gn-module.js";
import { corsMiddleware } from "@core/middleware/cors-middleware.js";
import { loggerMiddleware } from "@core/middleware/logger-middleware.js";
import { createLogger } from "@core/utils/logger.js";
import { serve } from "@hono/node-server";
import { getConnInfo } from "@hono/node-server/conninfo";
import { Hono } from "hono";
import { showRoutes } from "hono/dev";
import { HTTPException } from "hono/http-exception";
import { requestId } from "hono/request-id";

const mainLogger = createLogger();

export function start(modules: Array<GnModule>) {
  const app = new Hono({ strict: false });

  app.use("*", requestId({ headerName: "trace-id" }));
  app.use("*", corsMiddleware);

  app.get("/im-alive", loggerMiddleware(mainLogger), async (c) => {
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
    app.use(`/${module.namespace}/*`, loggerMiddleware(module.logger));
    app.route("/", module._router);
  }

  app.onError((err, c) => {
    const path = new URL(c.req.url).pathname;
    const logger =
      modules.find((m) => path.startsWith(`/${m.namespace}/`))?.logger ??
      mainLogger;

    const traceId = c.get("requestId");

    if (err instanceof HTTPException) {
      const data = {
        "trace-id": traceId,
        status: err.status,
        error: err.message,
      };
      void logger("ERROR", data);
      return c.json(data, err.status);
    }

    const stack = err.stack?.split("\n").map((l) => l.trim());

    const info = getConnInfo(c);
    const host = c.req.header("host") ?? "";
    const remoteAddress = info.remote.address ?? "";
    const remotePort = info.remote.port ?? 0;

    const data = {
      "trace-id": traceId,
      status: 500,
      error: stack?.shift(),
      extras: {
        status: 500,

        method: c.req.method,
        url: path,
        host,
        remoteAddress,
        remotePort,

        "stack-trace": stack,
      },
    };

    void logger("ERROR", data);

    if (mainEnv.APP_ENV !== "DEV") {
      // @ts-expect-error
      data.extras = undefined;
    }

    return c.json(data, 500);
  });

  if (mainEnv.APP_ENV === "DEV") {
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
