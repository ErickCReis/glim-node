import "dotenv/config";

import { type GnModule, mainEnv } from "@core/gn-module.js";
import { corsMiddleware } from "@core/middleware/cors-middleware.js";
import { loggerMiddleware } from "@core/middleware/logger-middleware.js";
import { createLogger } from "@core/utils/logger.js";
import { serve } from "@hono/node-server";
import { getConnInfo } from "@hono/node-server/conninfo";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Hono } from "hono";
import { showRoutes } from "hono/dev";
import { HTTPException } from "hono/http-exception";
import { requestId } from "hono/request-id";
import type { Redis } from "ioredis";

const mainLogger = createLogger();

export function start(modules: Array<GnModule>) {
  const app = new Hono({ strict: false });

  app.use("*", requestId({ headerName: "trace-id" }));
  app.use("*", corsMiddleware);

  app.get("/im-alive", loggerMiddleware(mainLogger), async (c) => {
    const info: Record<string, { status: "alive" | "dead"; latency: number }> =
      {};

    for (const m of modules) {
      // @ts-expect-error
      const db: NodePgDatabase | undefined = m.db;
      if (!db) {
        continue;
      }

      info[`db.${m.namespace}`] = await check(() =>
        db
          .execute("SELECT 1")
          .then((r) => r.rowCount === 1)
          .catch(() => false),
      );
    }

    for (const m of modules) {
      // @ts-expect-error
      const cache: Redis | undefined = m.cache;
      if (!cache) {
        continue;
      }

      info[`cache.${m.namespace}`] = await check(() =>
        cache.ping().then((r) => r === "PONG"),
      );
    }

    const someIsDead = Object.values(info).some((i) => i.status === "dead");
    return c.json(info, someIsDead ? 500 : 200);
  });

  for (const module of modules) {
    if (!module._router) {
      console.error(`Nenhum router fornecido para ${module.namespace}`);
      process.exit(1);
    }

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
  const elapsedTime = process.hrtime(startTime);
  const elapsedMS = (elapsedTime[0] * 1e9 + elapsedTime[1]) / 1e6;
  return {
    status: success ? ("alive" as const) : ("dead" as const),
    latency: elapsedMS,
  };
}
