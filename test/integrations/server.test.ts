import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import { Hono } from "hono";
import { createLoggerMock, createNodeServerEnv } from "../fixtures";
import { withEnv } from "../support";

afterEach(() => {
  mock.restore();
});

describe("server integrations", () => {
  it("starts through the public API", async () => {
    const serve = mock(
      (
        options: { fetch: typeof globalThis.fetch; port: number },
        onListen: (info: { port: number }) => void,
      ) => {
        onListen({ port: options.port });
        return options;
      },
    );

    mock.module("@hono/node-server", () => ({ serve }));
    mock.module("hono/dev", () => ({ showRoutes: mock(() => undefined) }));
    mock.module("pino", () => ({
      default: () => ({
        child: () => ({ info: () => undefined, error: () => undefined }),
        info: () => undefined,
        error: () => undefined,
      }),
    }));

    const { start } = await import("../../src/server/index");

    await withEnv(
      {
        APP_NAME: "glim",
        APP_ENV: "development",
        APP_CORS_ORIGIN: "*",
      },
      async () => {
        const consoleSpy = spyOn(console, "log").mockImplementation(() => undefined);

        await start({
          logger: {
            child: () => ({ info: () => undefined, error: () => undefined }),
            info: () => undefined,
            error: () => undefined,
          },
          env: {},
          "~context": null,
          "~router": new Hono().get("/health", (c) => c.text("ok")),
          imAlive: mock(async () => ["OK"] as const),
        } as never);

        expect(serve).toHaveBeenCalledTimes(1);
        expect(consoleSpy).toHaveBeenCalledWith("Server is running on port 3000");
      },
    );
  });

  it("builds a Hono app that can be tested with app.request", async () => {
    const { createServerApp } = await import("../../src/server/index");
    const mainLogger = createLoggerMock();
    const moduleLogger = createLoggerMock();

    await withEnv(
      {
        APP_NAME: "glim",
        APP_ENV: "development",
        APP_CORS_ORIGIN: "*",
      },
      async () => {
        const router = new Hono({ strict: false }).basePath("billing").route(
          "/",
          new Hono().get("/ping", (c) => c.text("pong")),
        );
        const module = {
          namespace: "billing",
          logger: moduleLogger,
          env: {},
          "~context": null,
          "~router": router,
          imAlive: mock(async () => ({
            "db.billing": { status: "alive", latency: 1 },
          })),
        };

        const app = await createServerApp([module] as never, {
          mainLogger: mainLogger as never,
        });

        const root = await app.request("http://localhost/", {}, createNodeServerEnv());
        expect(await root.text()).toBe("Hello world!");
        expect(root.headers.get("cache-control")).toContain("no-store");
        expect(root.headers.get("pragma")).toBe("no-cache");

        const ping = await app.request("http://localhost/billing/ping", {}, createNodeServerEnv());
        expect(await ping.text()).toBe("pong");
        expect(module["~context"]).not.toBeNull();

        const imAlive = await app.request(
          "http://localhost/im-alive/db?force=true",
          {},
          createNodeServerEnv(),
        );
        expect(imAlive.status).toBe(200);
        expect(await imAlive.json()).toEqual({
          "db.billing": { status: "alive", latency: 1 },
        });

        expect(mainLogger.info).toHaveBeenCalled();
        expect(moduleLogger.info).toHaveBeenCalled();
      },
    );
  });

  it("fails fast when a router is missing", async () => {
    const { createServerApp } = await import("../../src/server/index");
    const exitError = new Error("process.exit");
    const exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw exitError;
    });
    const errorSpy = spyOn(console, "error").mockImplementation(() => undefined);

    await withEnv(
      {
        APP_NAME: "glim",
        APP_ENV: "production",
        APP_CORS_ORIGIN: "*",
      },
      async () => {
        await expect(
          createServerApp(
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
            {
              mainLogger: createLoggerMock() as never,
            },
          ),
        ).rejects.toBe(exitError);

        expect(exitSpy).toHaveBeenCalledWith(1);
        expect(errorSpy).toHaveBeenCalled();
      },
    );
  });
});
