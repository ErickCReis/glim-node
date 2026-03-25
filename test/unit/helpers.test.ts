import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import { cacheRequest } from "../../src/helpers/cache-request";
import { md5, sha1, sha256 } from "../../src/helpers/crypto";
import { createHttpClient, getHttpEnv } from "../../src/helpers/http";
import { createLogger } from "../../src/helpers/logger";
import { getMysqlEnv } from "../../src/helpers/mysql";
import { getPostgresEnv } from "../../src/helpers/postgres";
import { getRedisEnv } from "../../src/helpers/redis";
import { getS3Env } from "../../src/helpers/s3";
import { getSNSEnv } from "../../src/helpers/sns";
import { time } from "../../src/helpers/time";
import { ensureTrailingSlash, formatEnvKey } from "../../src/helpers/utils";
import { createCacheDriver } from "../fixtures";
import { withEnv } from "../support";

afterEach(() => {
  mock.restore();
});

describe("helpers", () => {
  it("hashes values consistently", () => {
    expect(md5("glim")).toBe("b5207da636c23a750d526f149c235b60");
    expect(sha1("glim")).toBe("a6c8ffc2363fa9a96cd220f16a7ac84681c1d424");
    expect(sha256("glim")).toBe("a9cff6ad698ae78e6e9b764b3da78d9c5f41fa4af78f172eb730e1cd465c4026");
  });

  it("formats env keys", () => {
    expect(formatEnvKey("DB")).toBe("DB");
    expect(formatEnvKey("DB", "billing-service")).toBe("DB_BILLING_SERVICE");
    expect(formatEnvKey("DB", "billing", "db-reader")).toBe("DB_BILLING_READER");
  });

  it("normalizes trailing slashes", () => {
    expect(ensureTrailingSlash("https://api.example.com")).toBe("https://api.example.com/");
    expect(ensureTrailingSlash("https://api.example.com/")).toBe("https://api.example.com/");
  });

  it("converts durations and calculates the remaining time until end of day", () => {
    const nowSpy = spyOn(Date, "now").mockReturnValue(Date.UTC(2026, 2, 24, 12, 30, 0));

    expect(time("2h", { out: "m" })).toBe(120);
    expect(time.now({ out: "ms" })).toBe(Date.UTC(2026, 2, 24, 12, 30, 0));
    expect(time.untilEndOfDay({ out: "h", round: false })).toBe(11.5);

    nowSpy.mockRestore();
  });

  it("builds stable cache keys", async () => {
    const key = await cacheRequest.getKey(
      12,
      new Request("https://api.example.com/tasks?b=2&a=1", {
        method: "POST",
        body: JSON.stringify({ ok: true }),
        headers: { "content-type": "application/json" },
      }),
    );

    const equivalentKey = await cacheRequest.getKey(
      12,
      new Request("https://api.example.com/tasks?a=1&b=2", {
        method: "POST",
        body: JSON.stringify({ ok: true }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(key).toBe(equivalentKey);
  });

  it("reads, writes, and invalidates cache entries", async () => {
    const { driver } = createCacheDriver();
    const key = await cacheRequest.getKey(
      12,
      new Request("https://api.example.com/tasks", {
        method: "GET",
      }),
    );

    await cacheRequest.write(
      driver as never,
      key,
      Math.floor(Date.now() / 1000) + 60,
      JSON.stringify({ items: [1, 2] }),
    );
    expect(await cacheRequest.read(driver as never, key)).toEqual({
      items: [1, 2],
    });

    await cacheRequest.invalidateByUser(
      driver as never,
      12,
      new URL("https://api.example.com/tasks*"),
    );
    expect(await cacheRequest.read(driver as never, key)).toBe(false);
  });

  it("reads HTTP env", async () => {
    await withEnv(
      {
        HTTP_URL: "https://api.example.com",
        HTTP_TIMEOUT: "1500",
      },
      () => {
        expect(getHttpEnv()).toEqual({
          baseUrl: "https://api.example.com/",
          timeout: 1500,
        });
      },
    );
  });

  it("sends requests with global and local headers", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 }),
    );
    const client = createHttpClient({
      baseUrl: "https://api.example.com/",
      timeout: 1500,
      globalHeaders: () => ({ authorization: "Bearer token" }),
    });

    await client.post({
      path: "tasks",
      headers: { "x-trace": "123" },
      body: { ok: true },
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/tasks");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({
      "Content-Type": "application/json",
      authorization: "Bearer token",
      "x-trace": "123",
    });
    expect(init.body).toBe(JSON.stringify({ ok: true }));
  });

  it("reads database, cache, storage, and notification envs", async () => {
    await withEnv(
      {
        DB_BILLING_HOST: "db.local",
        DB_BILLING_DATABASE: "billing",
        DB_BILLING_USERNAME: "user",
        DB_BILLING_PASSWORD: "secret",
        CACHE_BILLING_PORT: "6379",
        CACHE_BILLING_HOST: "redis.local",
        STORAGE_BILLING_REGION: "us-east-1",
        STORAGE_BILLING_BUCKET: "files",
        STORAGE_BILLING_ACCESS_KEY: "key",
        STORAGE_BILLING_SECRET_KEY: "secret",
        NOTIFICATION_BILLING_REGION: "us-east-1",
        NOTIFICATION_BILLING_ACCESS_KEY: "key",
        NOTIFICATION_BILLING_SECRET_KEY: "secret",
        NOTIFICATION_BILLING_TOPIC_USER_CREATED_ARN: "arn:topic:user-created",
      },
      () => {
        expect(getPostgresEnv("billing")).toEqual({
          host: "db.local",
          database: "billing",
          username: "user",
          password: "secret",
          url: "postgresql://user:secret@db.local/billing",
        });
        expect(getMysqlEnv("billing")).toEqual({
          host: "db.local",
          database: "billing",
          username: "user",
          password: "secret",
          url: "mysql://user:secret@db.local/billing",
        });
        expect(getRedisEnv("billing")).toEqual({
          host: "redis.local",
          port: 6379,
        });
        expect(getS3Env("billing")).toEqual({
          region: "us-east-1",
          bucket: "files",
          endpoint: undefined,
          accessKeyId: "key",
          secretAccessKey: "secret",
        });
        expect(getSNSEnv("billing", "default", ["user-created"])).toEqual({
          region: "us-east-1",
          endpoint: undefined,
          accessKeyId: "key",
          secretAccessKey: "secret",
          topics: {
            "user-created": "arn:topic:user-created",
          },
        });
      },
    );
  });

  it("configures the logger from env", async () => {
    mock.module("pino", () => ({
      default: (options: unknown) => options,
    }));

    await withEnv(
      {
        APP_NAME: "glim",
        APP_ENV: "development",
      },
      () => {
        const logger = createLogger("billing") as unknown as Record<string, unknown>;
        expect(logger.level).toBe("debug");
        expect(logger.messageKey).toBe("message");
        expect(logger.transport).toEqual({
          target: "pino/file",
          options: { destination: "./logs/billing.log", mkdir: true },
        });
        expect(logger.timestamp).toBeFunction();
      },
    );
  });
});
