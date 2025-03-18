import "dotenv/config";

import type { ImAlive } from "@core/_internal/im-alive";
import { errorHandler } from "@core/exceptions/error-handler";
import type { GnModule } from "@core/gn-module";
import { coreEnv } from "@core/helpers/env";
import { createLogger } from "@core/helpers/logger";
import { cacheDriverMiddleware } from "@core/middleware/cache-middleware";
import { corsMiddleware } from "@core/middleware/cors-middleware";
import { errorMiddleware } from "@core/middleware/error-middleware";
import { loggerMiddleware } from "@core/middleware/logger-middleware";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { compress } from "hono/compress";
import { showRoutes } from "hono/dev";
import { requestId } from "hono/request-id";
import { validator } from "hono/validator";

const mainLogger = createLogger();

export async function start(modules: Array<GnModule>) {
  const app = new Hono({ strict: false })
    .use(
      "*",
      requestId({ headerName: "trace-id" }),
      errorMiddleware(),
      compress(),
      corsMiddleware(),
      await cacheDriverMiddleware(),
      async (c, next) => {
        c.header(
          "cache-control",
          "no-store, no-cache, must-revalidate, max-age=0, post-check=0, pre-check=0",
        );
        c.header("pragma", "no-cache");
        await next();
      },
    )
    .get(
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

    app
      .use(
        `/${module.namespace}/*`,
        loggerMiddleware(module),
        async (c, next) => {
          module._cacheMiddlewareDriver = c.var.driver;
          await next();
        },
      )
      .route("/", module._router);
  }

  app.onError((_, c) => errorHandler(c));

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
