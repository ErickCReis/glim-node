import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import { Hono } from "hono";
import { createApp } from "../../src/gn-app";
import { createModule } from "../../src/gn-module";
import { withCwd, withEnv, withTempDir } from "../support";

afterEach(() => {
  mock.restore();
});

describe("core integrations", () => {
  it("creates a module using real helper modules and external client mocks", async () => {
    const postgresDriver = {
      execute: mock(async () => ({ rowCount: 1 })),
    };
    const snsSend = mock(async () => ({
      Topics: [{ TopicArn: "arn:topic:user-created" }],
    }));
    const logger = {
      child: mock(() => logger),
      info: mock(() => undefined),
      error: mock(() => undefined),
    };
    const cacheDriver = {
      inDb: async (_db: number, fn: () => Promise<unknown>) => fn(),
      hkeys: mock(async () => ["/tasks:hash-a", "/users:hash-b"]),
      hdel: mock(async () => 1),
    };

    await mock.module("pino", () => ({
      default: () => logger,
    }));
    await mock.module("pg", () => ({
      default: {
        Pool: class {
          constructor(public config: unknown) {}
        },
      },
    }));
    await mock.module("drizzle-orm/node-postgres", () => ({
      drizzle: mock(() => postgresDriver),
    }));
    await mock.module("@aws-sdk/client-sns", () => ({
      SNSClient: class {
        send = snsSend;
      },
      ListTopicsCommand: class {
        constructor(public input: unknown) {}
      },
      PublishCommand: class {
        constructor(public input: unknown) {}
      },
    }));

    await withTempDir("glim-core-module", async (cwd) => {
      await withCwd(cwd, async () => {
        await withEnv(
          {
            APP_NAME: "glim",
            APP_ENV: "development",
            DB_BILLING_HOST: "db.local",
            DB_BILLING_DATABASE: "billing",
            DB_BILLING_USERNAME: "user",
            DB_BILLING_PASSWORD: "secret",
            NOTIFICATION_BILLING_S_REGION: "us-east-1",
            NOTIFICATION_BILLING_S_ACCESS_KEY: "key",
            NOTIFICATION_BILLING_S_SECRET_KEY: "secret",
            NOTIFICATION_BILLING_S_TOPIC_USER_CREATED_ARN: "arn:topic:user-created",
          },
          async () => {
            const module = await createModule("billing", {
              db: { type: "db.postgres" },
              notifications: {
                type: "notification.sns",
                config: { topics: ["user-created"] },
              },
            });

            expect(module.namespace).toBe("billing");
            expect(module.db as unknown).toBe(postgresDriver);
            expect(typeof module.notifications.listTopics).toBe("function");

            const imAlive = await module.imAlive("all", true);
            expect(imAlive).toMatchObject({
              "db.billing": { status: "alive" },
              "notification.billing.s": { status: "alive" },
            });

            const router = new Hono().get("/ping", (c) => c.text("pong"));
            module.loadRouter(router);
            const mountedRouter = module["~router"];
            if (!mountedRouter) {
              throw new Error("Router was not loaded");
            }
            const response = await mountedRouter.request("http://localhost/billing/ping");
            expect(await response.text()).toBe("pong");

            module["~context"] = {
              var: {
                driver: cacheDriver,
                auth: { id: 7 },
              },
            } as never;
            await module.invalidateCacheMiddleware(new URL("https://api.example.com/tasks*"));
            await module.invalidateCacheMiddlewareByUser(new URL("https://api.example.com/tasks*"));

            expect(cacheDriver.hdel).toHaveBeenNthCalledWith(1, "CACHE_REQUEST:0", "/tasks:hash-a");
            expect(cacheDriver.hdel).toHaveBeenNthCalledWith(2, "CACHE_REQUEST:7", "/tasks:hash-a");
          },
        );
      });
    });
  });

  it("creates an app using the real http helper", async () => {
    const logger = {
      child: mock(() => logger),
      info: mock(() => undefined),
      error: mock(() => undefined),
    };
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 200 }),
    );

    await mock.module("pino", () => ({
      default: () => logger,
    }));

    await withTempDir("glim-core-app", async (cwd) => {
      await withCwd(cwd, async () => {
        await withEnv(
          {
            APP_NAME: "glim",
            APP_ENV: "development",
            HTTP_API_URL: "https://api.example.com",
            HTTP_API_TIMEOUT: "1000",
          },
          async () => {
            const app = await createApp({
              api: { type: "http.webservice" },
            });

            expect(typeof app.api.get).toBe("function");

            const imAlive = await app.imAlive("all", true);
            expect(imAlive).toMatchObject({
              "http.app.api": { status: "alive" },
            });
            expect(fetchSpy).toHaveBeenCalled();

            const router = new Hono().get("/health", (c) => c.text("ok"));
            app.loadRouter(router);
            const mountedRouter = app["~router"];
            if (!mountedRouter) {
              throw new Error("Router was not loaded");
            }
            const response = await mountedRouter.request("http://localhost/health");
            expect(await response.text()).toBe("ok");
          },
        );
      });
    });
  });
});
