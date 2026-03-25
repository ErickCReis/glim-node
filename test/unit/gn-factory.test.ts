import { describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";
import {
  createAppWithRuntime,
  createModuleWithRuntime,
} from "../../src/_internal/gn-factory";
import { createCacheDriver, createLoggerMock } from "../fixtures";

describe("gn factory", () => {
  it("creates feature aliases and imAlive metadata for modules", async () => {
    const logger = createLoggerMock();
    const createFeature = mock(
      async (type: string, config: unknown, _base: unknown, alias: string) => ({
        type,
        config,
        alias,
      }),
    );
    const imAlive = mock(async () => ["OK"] as const);
    const createImAlive = mock((_namespace: string, features: unknown) => {
      expect(features).toMatchObject({
        db: { type: "db.postgres", driver: { alias: "default" } },
        notifications: {
          type: "notification.sns",
          driver: { alias: "notifications" },
        },
      });
      return imAlive;
    });

    const module = await createModuleWithRuntime(
      "billing",
      {
        db: { type: "db.postgres" },
        notifications: {
          type: "notification.sns",
          config: { topics: ["user-created"] },
        },
      },
      {
        createFeature: createFeature as never,
        createImAlive: createImAlive as never,
        createLogger: (() => logger) as never,
      },
    );

    expect(module.namespace).toBe("billing");
    expect(module.logger as unknown).toBe(logger);
    expect(createFeature.mock.calls.map((call) => [call[0], call[3]])).toEqual([
      ["db.postgres", "default"],
      ["notification.sns", "notifications"],
    ]);
    expect(await module.imAlive("all", true)).toEqual(["OK"]);
  });

  it("mounts app routers at the root path", async () => {
    const app = await createAppWithRuntime(
      {
        api: { type: "http.webservice" },
      },
      {
        createFeature: (async () => ({
          get: async () => new Response(),
        })) as never,
        createImAlive: (() => mock(async () => ({ ok: true }))) as never,
        createLogger: (() => createLoggerMock()) as never,
      },
    );

    app.loadRouter(new Hono().get("/health", (c) => c.text("ok")));
    const router = app["~router"];
    if (!router) {
      throw new Error("Router was not loaded");
    }
    const response = await router.request("http://localhost/health");

    expect(await response.text()).toBe("ok");
  });

  it("mounts module routers under the namespace path", async () => {
    const module = await createModuleWithRuntime(
      "billing",
      {},
      {
        createImAlive: (() => mock(async () => ({ ok: true }))) as never,
        createLogger: (() => createLoggerMock()) as never,
      },
    );

    module.loadRouter(new Hono().get("/ping", (c) => c.text("pong")));
    const router = module["~router"];
    if (!router) {
      throw new Error("Router was not loaded");
    }
    const response = await router.request("http://localhost/billing/ping");

    expect(await response.text()).toBe("pong");
  });

  it("invalidates cache keys from the current context", async () => {
    const { driver, store } = createCacheDriver({
      "CACHE_REQUEST:0": {
        "/tasks:hash-a": JSON.stringify({ ok: true }),
        "/users:hash-b": JSON.stringify({ ok: true }),
      },
      "CACHE_REQUEST:7": {
        "/tasks:hash-a": JSON.stringify({ ok: true }),
      },
    });
    const module = await createModuleWithRuntime(
      "billing",
      {},
      {
        createImAlive: (() => mock(async () => ({ ok: true }))) as never,
        createLogger: (() => createLoggerMock()) as never,
      },
    );

    module["~context"] = {
      var: {
        driver,
        auth: { id: 7 },
      },
    } as never;

    await module.invalidateCacheMiddleware(
      new URL("https://api.example.com/tasks*"),
    );
    await module.invalidateCacheMiddlewareByUser(
      new URL("https://api.example.com/tasks*"),
    );

    expect(store.get("CACHE_REQUEST:0")?.has("/tasks:hash-a")).toBe(false);
    expect(store.get("CACHE_REQUEST:0")?.has("/users:hash-b")).toBe(true);
    expect(store.get("CACHE_REQUEST:7")?.has("/tasks:hash-a")).toBe(false);
  });
});
