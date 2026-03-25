import { afterEach, describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";
import { authMiddleware } from "../../src/middleware/auth-middleware";
import { bifrostMiddleware } from "../../src/middleware/bifrost-middleware";
import { cacheMiddleware, cacheMiddlewareByUser } from "../../src/middleware/cache-middleware";
import { clientMiddleware } from "../../src/middleware/client-middleware";
import { errorMiddleware } from "../../src/middleware/error-middleware";
import { loggerMiddleware } from "../../src/middleware/logger-middleware";
import { createCacheDriver, createLoggerMock, createNodeServerEnv } from "../fixtures";
import { withEnv } from "../support";

afterEach(() => {
  mock.restore();
});

describe("middleware", () => {
  it("reads auth from the x-auth header", async () => {
    const app = new Hono();
    app.use("*", authMiddleware);
    app.get("/", (c) => c.json((c.var as never as { auth: Record<string, unknown> }).auth));

    const response = await app.request("http://localhost/", {
      headers: {
        "x-auth": btoa(JSON.stringify({ id: 1, name: "Ana", nickname: "ana" })),
      },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: 1,
      name: "Ana",
      nickname: "ana",
    });
  });

  it("rejects missing auth headers", async () => {
    const app = new Hono();
    app.use("*", authMiddleware);
    app.get("/", (c) => c.json({ ok: true }));

    expect((await app.request("http://localhost/")).status).toBe(401);
  });

  it("reads client metadata from the x-client header", async () => {
    const app = new Hono();
    app.use("*", clientMiddleware);
    app.get("/", (c) => c.json((c.var as never as { client: Record<string, unknown> }).client));

    const response = await app.request("http://localhost/", {
      headers: {
        "x-client": btoa(JSON.stringify({ id: 2, key: "web", version: "1.0.0" })),
      },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: 2,
      key: "web",
      version: "1.0.0",
    });
  });

  it("rejects missing client headers", async () => {
    const app = new Hono();
    app.use("*", clientMiddleware);
    app.get("/", (c) => c.json({ ok: true }));

    expect((await app.request("http://localhost/")).status).toBe(400);
  });

  it("requires the x-bifrost header", async () => {
    const app = new Hono();
    app.use("*", bifrostMiddleware);
    app.get("/", (c) => c.text("ok"));

    expect((await app.request("http://localhost/")).status).toBe(400);
    expect(
      (
        await app.request("http://localhost/", {
          headers: { "x-bifrost": "present" },
        })
      ).status,
    ).toBe(200);
  });

  it("serves cached GET responses", async () => {
    await withEnv(
      {
        APP_NAME: "glim",
        APP_ENV: "development",
        CACHE_MIDDLEWARE: "true",
      },
      async () => {
        const { driver } = createCacheDriver();
        let hits = 0;
        const app = new Hono();

        app.use("*", async (c, next) => {
          (c as never as { set: (key: string, value: unknown) => void }).set("driver", driver);
          await next();
        });
        app.use("*", cacheMiddleware(300));
        app.get("/items", (c) => {
          hits += 1;
          return c.json({ hits });
        });

        const first = await app.request("http://localhost/items");
        const second = await app.request("http://localhost/items");

        expect(first.headers.get("x-cache-middleware")).toBe("false");
        expect(await first.json()).toEqual({ hits: 1 });
        expect(second.headers.get("x-cache-middleware")).toBe("true");
        expect(await second.json()).toEqual({ hits: 1 });
        expect(hits).toBe(1);
      },
    );
  });

  it("skips cache handling for non-GET requests", async () => {
    await withEnv(
      {
        APP_NAME: "glim",
        APP_ENV: "development",
        CACHE_MIDDLEWARE: "true",
      },
      async () => {
        const { driver } = createCacheDriver();
        const app = new Hono();

        app.use("*", async (c, next) => {
          (c as never as { set: (key: string, value: unknown) => void }).set("driver", driver);
          await next();
        });
        app.use("*", cacheMiddleware(300));
        app.post("/items", (c) => c.json({ method: "post" }));

        const response = await app.request("http://localhost/items", {
          method: "POST",
        });

        expect(response.headers.get("x-cache-middleware")).toBeNull();
      },
    );
  });

  it("requires auth when using cacheMiddlewareByUser", async () => {
    await withEnv(
      {
        APP_NAME: "glim",
        APP_ENV: "development",
        CACHE_MIDDLEWARE: "true",
      },
      async () => {
        const app = new Hono();
        app.use("*", async (c, next) => {
          (c as never as { set: (key: string, value: unknown) => void }).set("driver", {
            inDb: async (_db: number, fn: () => Promise<unknown>) => fn(),
          });
          await next();
        });
        app.use("*", cacheMiddlewareByUser(10));
        app.get("/", (c) => c.json({ ok: true }));
        app.onError((_error, c) => c.body(null, 500));

        const response = await app.request("http://localhost/");

        expect(response.status).toBe(500);
      },
    );
  });

  it("wraps thrown errors", async () => {
    await withEnv(
      {
        APP_NAME: "glim",
        APP_ENV: "development",
      },
      async () => {
        const logger = createLoggerMock();
        const app = new Hono();
        app.use("*", async (c, next) => {
          c.set("requestId", "trace-1");
          await next();
        });
        app.use("*", loggerMiddleware({ logger } as never));
        app.use("*", errorMiddleware());
        app.get("/boom", () => {
          throw new Error("boom");
        });
        app.onError((_error, c) => c.body(null, 500));

        const response = await app.request("http://localhost/boom", {}, createNodeServerEnv());

        expect(response.status).toBe(500);
        expect(await response.json()).toMatchObject({
          status: 500,
          message: "boom",
        });
        expect(logger.error).toHaveBeenCalledTimes(1);
      },
    );
  });

  it("logs the request lifecycle", async () => {
    await withEnv(
      {
        APP_NAME: "glim",
        APP_ENV: "development",
      },
      async () => {
        const logger = createLoggerMock();
        const app = new Hono();

        app.use("*", async (c, next) => {
          c.set("requestId", "trace-1");
          await next();
        });
        app.use("*", loggerMiddleware({ logger } as never));
        app.get("/", (c) => c.json({ ok: true }));

        const response = await app.request("http://localhost/", {}, createNodeServerEnv());

        expect(response.status).toBe(200);
        expect(logger.info).toHaveBeenCalledTimes(2);
      },
    );
  });
});
