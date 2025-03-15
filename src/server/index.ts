import "dotenv/config";

import type { ImAlive } from "@core/_internal/im-alive";
import type { GnModule } from "@core/gn-module.js";
import { coreEnv } from "@core/helpers/env.js";
import { createLogger } from "@core/helpers/logger.js";
import { cacheDriverMiddleware } from "@core/middleware/cache-middleware";
import { corsMiddleware } from "@core/middleware/cors-middleware.js";
import { loggerMiddleware } from "@core/middleware/logger-middleware.js";
import { serve } from "@hono/node-server";
import { getConnInfo } from "@hono/node-server/conninfo";
import { Hono } from "hono";
import { compress } from "hono/compress";
import { showRoutes } from "hono/dev";
import { HTTPException } from "hono/http-exception";
import { requestId } from "hono/request-id";
import { validator } from "hono/validator";

export async function start(modules: Array<GnModule>) {
  const mainLogger = createLogger();

  const app = new Hono({ strict: false });

  app.use(
    "*",
    requestId({ headerName: "trace-id" }),
    compress(),
    corsMiddleware,
    await cacheDriverMiddleware(),
    async (c, next) => {
      c.header(
        "cache-control",
        "no-store, no-cache, must-revalidate, max-age=0, post-check=0, pre-check=0",
      );
      c.header("pragma", "no-cache");
      await next();
    },
  );

  app.get(
    "/im-alive/:resource?",
    loggerMiddleware({ logger: mainLogger }),
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

    app.use(`/${module.namespace}/*`, loggerMiddleware(module));
    app.route("/", module._router);
  }

  app.onError((err, c) => {
    const path = new URL(c.req.url).pathname;
    const logger = (
      modules.find((m) => path.startsWith(`/${m.namespace}/`))?.logger ??
      mainLogger
    ).child({ "trace-id": c.var.requestId });

    logger.error(err, err.message);

    if (err instanceof HTTPException) {
      return c.json(
        {
          status: err.status,
          error: err.message,
        },
        err.status,
      );
    }

    const stack = err.stack?.split("\n").map((l) => l.trim());
    const data = {
      status: 500,
      error: stack?.shift(),
      extras: undefined as unknown as Record<string, unknown>,
    };

    if (coreEnv.APP_ENV === "DEV") {
      const info = getConnInfo(c);
      const host = c.req.header("host") ?? "";
      const remoteAddress = info.remote.address ?? "";
      const remotePort = info.remote.port ?? 0;

      data.extras = {
        status: 500,

        method: c.req.method,
        url: path,
        host,
        remoteAddress,
        remotePort,

        "stack-trace": stack,
      };
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
      console.log(`Server is running on port ${info.port}`);
    },
  );
}
