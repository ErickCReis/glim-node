import { expectTypeOf } from "bun:test";
import { createModule } from "../../src";
import type { createHttpClient } from "../../src/helpers/http";
import type { createPostgresClient } from "../../src/helpers/postgres";
import type { Redis } from "../../src/helpers/redis";
import type { S3 } from "../../src/helpers/s3";

const billingModule = await createModule("billing", {
  db: {
    type: "db.postgres",
  },
  cache: {
    type: "cache.redis",
  },
  storage: {
    type: "storage.s3",
  },
  notifications: {
    type: "notification.sns",
    config: {
      topics: ["user-created", "task-updated"],
    },
  },
  reportingApi: {
    type: "http.webservice",
  },
});

type BillingModule = Awaited<typeof billingModule>;
type NotificationTopic = Parameters<
  BillingModule["notifications"]["publish"]
>[0];

expectTypeOf<BillingModule["namespace"]>().toEqualTypeOf<"billing">();
expectTypeOf<BillingModule["db"]>().toEqualTypeOf<
  ReturnType<typeof createPostgresClient>
>();
expectTypeOf<BillingModule["cache"]>().toEqualTypeOf<Redis>();
expectTypeOf<BillingModule["storage"]>().toEqualTypeOf<S3>();
expectTypeOf<BillingModule["reportingApi"]>().toEqualTypeOf<
  ReturnType<typeof createHttpClient>
>();
expectTypeOf<NotificationTopic>().toEqualTypeOf<
  "user-created" | "task-updated"
>();

expectTypeOf(billingModule.namespace).toEqualTypeOf<"billing">();
expectTypeOf(billingModule.db).toEqualTypeOf<
  ReturnType<typeof createPostgresClient>
>();
expectTypeOf(billingModule.cache).toEqualTypeOf<Redis>();
expectTypeOf(billingModule.storage).toEqualTypeOf<S3>();
expectTypeOf(billingModule.reportingApi).toEqualTypeOf<
  ReturnType<typeof createHttpClient>
>();

await billingModule.notifications.publish("user-created", "ok");
await billingModule.notifications.publish("task-updated", "ok");
// @ts-expect-error configured topics should be preserved on the notification client
await billingModule.notifications.publish("invoice-created", "ok");

const aliasedModule = await createModule("accounting", {
  reportingDb: {
    type: "db.postgres",
  },
});

type AliasedModule = Awaited<typeof aliasedModule>;
expectTypeOf<AliasedModule["reportingDb"]>().toEqualTypeOf<
  ReturnType<typeof createPostgresClient>
>();

await createModule("billing", {
  // @ts-expect-error notification.sns requires a topics config
  notifications: {
    type: "notification.sns",
  },
});

await createModule("billing", {
  // @ts-expect-error reserved base module keys cannot be redefined as features
  logger: {
    type: "db.postgres",
  },
});
