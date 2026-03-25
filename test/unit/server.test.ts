import { afterEach, describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { createLoggerMock } from "../fixtures";
import { withEnv } from "../support";

afterEach(() => {
  mock.restore();
});

describe("server runtime", () => {
  it("builds a testable Hono app without external server dependencies", async () => {
    mock.module("@hono/node-server", () => ({
      serve: mock(() => undefined),
    }));

    await withEnv(
      {
        APP_NAME: "glim",
        APP_ENV: "development",
        APP_CORS_ORIGIN: "*",
      },
      async () => {
        const { createServerAppWithRuntime } = await import(
          "../../src/_internal/server-runtime"
        );
        const createCacheDriverMiddleware = mock(async () =>
          createMiddleware(async (_c, next) => {
            await next();
          }),
        );
        const app = await createServerAppWithRuntime(
          [
            {
              namespace: "billing",
              logger: createLoggerMock(),
              env: {},
              "~context": null,
              "~router": new Hono({ strict: false }).basePath("billing").route(
                "/",
                new Hono().get("/ping", (c) => c.text("pong")),
              ),
              imAlive: mock(async () => ({
                "db.billing": { status: "alive", latency: 1 },
              })),
            },
          ] as never,
          { mainLogger: createLoggerMock() as never },
          {
            createCacheDriverMiddleware,
          },
        );

        expect(typeof app.request).toBe("function");
        expect(createCacheDriverMiddleware).toHaveBeenCalledTimes(1);
      },
    );
  });

  it("uses the injected exit strategy when a router is missing", async () => {
    mock.module("@hono/node-server", () => ({
      serve: mock(() => undefined),
    }));

    await withEnv(
      {
        APP_NAME: "glim",
        APP_ENV: "production",
        APP_CORS_ORIGIN: "*",
      },
      async () => {
        const { createServerAppWithRuntime } = await import(
          "../../src/_internal/server-runtime"
        );
        const exitError = new Error("exit");
        const exit = mock(() => {
          throw exitError;
        });
        const error = mock(() => undefined);

        await expect(
          createServerAppWithRuntime(
            [
              {
                namespace: "billing",
                logger: createLoggerMock(),
                env: {},
                "~context": null,
                "~router": null,
                imAlive: mock(async () => ["OK"] as const),
              },
            ] as never,
            {},
            {
              console: { error, log: mock(() => undefined) },
              createCacheDriverMiddleware: async () =>
                createMiddleware(async (_c, next) => {
                  await next();
                }),
              exit: exit as never,
            },
          ),
        ).rejects.toBe(exitError);

        expect(exit).toHaveBeenCalledWith(1);
        expect(error).toHaveBeenCalled();
      },
    );
  });

  it("delegates startup to the injected server runtime", async () => {
    mock.module("@hono/node-server", () => ({
      serve: mock(() => undefined),
    }));

    await withEnv(
      {
        APP_NAME: "glim",
        APP_ENV: "development",
        APP_CORS_ORIGIN: "*",
      },
      async () => {
        const { startWithRuntime } = await import(
          "../../src/_internal/server-runtime"
        );
        const serve = mock(
          (
            options: { fetch: typeof globalThis.fetch; port: number },
            onListen: (info: { port: number }) => void,
          ) => {
            onListen({ port: options.port });
            return options;
          },
        );
        const showRoutes = mock(() => undefined);
        const consoleLog = mock(() => undefined);

        await startWithRuntime(
          {
            logger: createLoggerMock(),
            env: {},
            "~context": null,
            "~router": new Hono().get("/health", (c) => c.text("ok")),
            imAlive: mock(async () => ["OK"] as const),
          } as never,
          {
            console: { error: mock(() => undefined), log: consoleLog },
            createCacheDriverMiddleware: async () =>
              createMiddleware(async (_c, next) => {
                await next();
              }),
            createLogger: (() => createLoggerMock()) as never,
            serve: serve as never,
            showRoutes: showRoutes as never,
          },
        );

        expect(serve).toHaveBeenCalledTimes(1);
        expect(showRoutes).toHaveBeenCalledTimes(1);
        expect(consoleLog).toHaveBeenCalledWith(
          "Server is running on port 3000",
        );
      },
    );
  });
});
