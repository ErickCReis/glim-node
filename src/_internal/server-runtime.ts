import type { ImAlive } from "@core/_internal/im-alive";
import { errorHandler } from "@core/exceptions/error-handler";
import type { AnyGnApp } from "@core/gn-app";
import type { AnyGnModule } from "@core/gn-module";
import { coreEnv } from "@core/helpers/env";
import type { Logger } from "@core/helpers/logger";
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

type ServerOptions = {
  mainLogger?: Logger;
};

type ServerModule = AnyGnModule | AnyGnApp;
type ServerModulesInput = ReadonlyArray<ServerModule> | ServerModule;

type ServerRuntime = {
  createLogger?: typeof createLogger;
  createCacheDriverMiddleware?: typeof cacheDriverMiddleware;
  serve?: typeof serve;
  showRoutes?: typeof showRoutes;
  exit?: typeof process.exit;
  console?: Pick<Console, "error" | "log">;
};

const defaultExit: typeof process.exit = (code) => process.exit(code);

function resolveRuntime(runtime: ServerRuntime = {}) {
  return {
    createLogger: runtime.createLogger ?? createLogger,
    createCacheDriverMiddleware: runtime.createCacheDriverMiddleware ?? cacheDriverMiddleware,
    serve: runtime.serve ?? serve,
    showRoutes: runtime.showRoutes ?? showRoutes,
    exit: runtime.exit ?? defaultExit,
    console: runtime.console ?? console,
  };
}

export async function createServerAppWithRuntime(
  modules: ServerModulesInput,
  options: ServerOptions = {},
  runtime: ServerRuntime = {},
) {
  const resolvedRuntime = resolveRuntime(runtime);
  const mainLogger = options.mainLogger ?? resolvedRuntime.createLogger();
  const cacheDriver = await resolvedRuntime.createCacheDriverMiddleware();
  const app = new Hono({ strict: false })
    .use(
      "*",
      requestId({ headerName: "trace-id" }),
      errorMiddleware(),
      compress(),
      corsMiddleware(),
      cacheDriver,
      async (c, next) => {
        c.header(
          "cache-control",
          "no-store, no-cache, must-revalidate, max-age=0, post-check=0, pre-check=0",
        );
        c.header("pragma", "no-cache");
        await next();
      },
    )
    .get("/", (c) => c.text("Hello world!"))
    .get(
      "/im-alive/:resource?",
      loggerMiddleware({ logger: mainLogger }),
      validator("param", (value, c) => {
        const validResources = ["db", "cache", "storage", "notification", "http"] as const;
        const resource = value.resource as (typeof validResources)[number] | undefined;
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
        const moduleArray = Array.isArray(modules) ? modules : [modules];
        const info = await Promise.all(
          moduleArray.map((module) =>
            module.imAlive(c.req.valid("param").resource ?? "all", c.req.valid("query").force),
          ),
        );

        const response: Record<string, ImAlive> = {};
        for (const item of info) {
          if (Array.isArray(item)) {
            return c.json(item, 200);
          }

          Object.assign(response, item);
        }

        const someIsDead = Object.values(response).some((item) => item.status === "dead");
        return c.json(response, someIsDead ? 500 : 200);
      },
    );

  const moduleArray = Array.isArray(modules) ? modules : [modules];

  for (const module of moduleArray) {
    const router = module["~router"];
    const namespace = "namespace" in module ? module.namespace : undefined;

    if (!router) {
      resolvedRuntime.console.error(
        `Nenhum router fornecido${namespace ? ` para ${namespace}` : ""}`,
      );
      resolvedRuntime.exit(1);
      continue;
    }

    if (namespace) {
      app
        .use(`/${namespace}/*`, loggerMiddleware(module), async (c, next) => {
          module["~context"] = c;
          await next();
        })
        .route("/", router);
      continue;
    }

    app
      .use("/*", loggerMiddleware(module), async (c, next) => {
        module["~context"] = c;
        await next();
      })
      .route("/", router);
  }

  app.onError((_, c) => errorHandler(c));

  return app;
}

export async function startWithRuntime(modules: ServerModulesInput, runtime: ServerRuntime = {}) {
  const resolvedRuntime = resolveRuntime(runtime);
  const app = await createServerAppWithRuntime(
    modules,
    {
      mainLogger: resolvedRuntime.createLogger(),
    },
    resolvedRuntime,
  );

  if (coreEnv.APP_ENV === "DEV") {
    resolvedRuntime.showRoutes(app, { verbose: true });
  }

  resolvedRuntime.serve(
    {
      fetch: app.fetch,
      port: 3000,
    },
    (info) => {
      resolvedRuntime.console.log(`Server is running on port ${info.port}`);
    },
  );
}
