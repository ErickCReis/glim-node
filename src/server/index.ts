import "dotenv/config";

import type { GnModule, ImAlive } from "@core/gn-module.js";
import { coreEnv } from "@core/helpers/env.js";
import { createLogger } from "@core/helpers/logger.js";
import { corsMiddleware } from "@core/middleware/cors-middleware.js";
import { loggerMiddleware } from "@core/middleware/logger-middleware.js";
import { serve } from "@hono/node-server";
import { getConnInfo } from "@hono/node-server/conninfo";
import { Hono } from "hono";
import { showRoutes } from "hono/dev";
import { HTTPException } from "hono/http-exception";
import { requestId } from "hono/request-id";
import { validator } from "hono/validator";

const mainLogger = createLogger();

export function start(modules: Array<GnModule>) {
  const app = new Hono({ strict: false });

  app.use("*", requestId({ headerName: "trace-id" }));
  app.use("*", corsMiddleware);

  app.get(
    "/im-alive/:resource?",
    loggerMiddleware(mainLogger),
    validator("param", (value, c) => {
      const validResources = ["db", "cache", "storage"] as const;
      const resource = value.resource as
        | (typeof validResources)[number]
        | undefined;
      if (resource && !validResources.includes(resource)) {
        return c.notFound();
      }

      return { resource };
    }),
    validator("query", (value) => {
      const force = value.force !== undefined;
      return { force };
    }),
    async (c) => {
      const info = await Promise.all(
        modules.map((m) =>
          m.imAlive(
            c.req.valid("param").resource ?? "all",
            c.req.valid("query").force,
          ),
        ),
      );

      const res: Record<string, ImAlive> = {};
      for (const i of info) {
        if (Array.isArray(i)) {
          return c.json(i, 200);
        }

        Object.assign(res, i);
      }

      const someIsDead = Object.values(res).some((i) => i.status === "dead");
      return c.json(res, someIsDead ? 500 : 200);
    },
  );

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

    if (coreEnv.APP_ENV !== "DEV") {
      // @ts-expect-error
      data.extras = undefined;
    }

    return c.json(data, 500);
  });

  if (coreEnv.APP_ENV === "DEV") {
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
