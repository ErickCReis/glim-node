import { createApp, createModule } from "glim-node";
import { authMiddleware, cacheMiddlewareByUser } from "glim-node/middleware";
import { start } from "glim-node/server";
import { Hono } from "hono";

const app = await createApp({
  db: {
    type: "db.postgres",
  },
  cache: {
    type: "cache.redis",
  },
  notification: {
    type: "notification.sns",
    config: {
      topics: ["task-created", "task-updated"],
    },
  },
  reportingApi: {
    type: "http.webservice",
  },
});

new Hono().use(authMiddleware).get("/tasks", cacheMiddlewareByUser(), (c) => {
  return c.json({ ok: true });
});

app.loadRouter(new Hono());
app.db.select();
await app.notification.publish("task-created", "ok");
await app.notification.publish("task-updated", "ok");
void app.reportingApi.post({ path: "/health" });
void start([app]);

// @ts-expect-error configured topics should be preserved in the built package types
await app.notification.publish("invoice-created", "ok");

const billingModule = await createModule("billing", {
  db: {
    type: "db.postgres",
  },
  notification: {
    type: "notification.sns",
    config: {
      topics: ["task-created"],
    },
  },
});

billingModule.loadRouter(new Hono());
await billingModule.notification.publish("task-created", "ok");
void start([billingModule]);

await createModule("billing", {
  // @ts-expect-error notification.sns still requires topics in the built package types
  notification: {
    type: "notification.sns",
  },
});
