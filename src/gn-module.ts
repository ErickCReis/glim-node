import {
  coreEnv,
  getPostgresEnv,
  getRedisEnv,
  getS3Env,
} from "@core/helpers/env.js";
import { type Logger, createLogger } from "@core/helpers/logger.js";
import type { createS3Client } from "@core/helpers/s3.js";
import type { drizzle } from "drizzle-orm/node-postgres";
import { Hono } from "hono";
import { hc } from "hono/client";
import type { Redis } from "ioredis";

// biome-ignore lint/complexity/noBannedTypes:
type EmptyObject = {};

// Define config type that allows for partial configuration
type ModuleConfig<TStorageKeys extends Array<string> | undefined> = {
  db?: "postgres";
  cache?: "redis";
  storage?: TStorageKeys;
};

export type ImAlive = {
  status: "alive" | "dead";
  latency: number;
};

// Define base module without optional components
type BaseModule<TNamespace extends string> = {
  namespace: TNamespace;
  env: typeof coreEnv;
  logger: Logger;
  imAlive: () => Promise<Record<string, ImAlive>>;
  _router: Hono | null;
  loadRouter<TRouter extends Hono>(
    router: TRouter,
  ): ReturnType<typeof hc<TRouter>>;
};

// Define return types based on configuration
type ModuleWithOptions<
  TNamespace extends string,
  HasDB extends boolean = false,
  HasCache extends boolean = false,
  StorageKeys extends Array<string> | undefined = undefined,
> = BaseModule<TNamespace> &
  (HasDB extends true ? { db: ReturnType<typeof drizzle> } : EmptyObject) &
  (HasCache extends true ? { cache: Redis } : EmptyObject) &
  (StorageKeys extends undefined
    ? EmptyObject
    : {
        storage: {
          [K in StorageKeys extends Array<infer U> ? U : never]: ReturnType<
            typeof createS3Client
          >;
        };
      });

// Implementation with proper type handling
export async function createModule<
  const TNamespace extends string,
  const StorageKeys extends Array<string> | undefined,
  const TConfig extends ModuleConfig<StorageKeys>,
>(
  namespace: TNamespace,
  config?: TConfig,
): Promise<
  ModuleWithOptions<
    TNamespace,
    TConfig extends { db: "postgres" } ? true : false,
    TConfig extends { cache: "redis" } ? true : false,
    TConfig["storage"]
  >
> {
  // Add database if configured
  const db =
    config?.db === "postgres"
      ? { db: await createPostgresConnection(namespace) }
      : {};

  // Add cache if configured
  const cache =
    config?.cache === "redis"
      ? { cache: await createRedisConnection(namespace) }
      : {};

  // Add storages if configured
  const storages = await Promise.all(
    (config?.storage ?? []).map(async (s) => {
      return {
        name: s,
        storage: await createS3Connection(namespace, s),
      };
    }),
  );

  const storage =
    storages.length > 0
      ? {
          storage: storages.reduce(
            (acc, { name, storage }) => {
              acc[name] = storage;
              return acc;
            },
            {} as Record<string, ReturnType<typeof createS3Client>>,
          ),
        }
      : {};

  async function imAlive() {
    const results = await Promise.all([
      db.db &&
        check(`db.${namespace}`, () =>
          db.db
            .execute("SELECT 1")
            .then((r) => r.rowCount === 1)
            .catch(() => false),
        ),

      cache.cache &&
        check(`cache.${namespace}`, () =>
          cache.cache.ping().then((r) => r === "PONG"),
        ),

      ...(storage.storage
        ? Object.entries(storage.storage).map(([key, value]) =>
            check(`storage.${namespace}.${key}`, () =>
              value
                .listBuckets()
                .then(() => true)
                .catch(() => false),
            ),
          )
        : []),
    ]);

    const res = {};
    for (const r of results) Object.assign(res, r);
    return res;
  }

  const result = {
    namespace,
    env: coreEnv,
    logger: createLogger(namespace),
    imAlive,
    _router: null as unknown as Hono,
    loadRouter<TRouter extends Hono>(router: TRouter) {
      this._router = new Hono().basePath(namespace).route("", router);
      return hc<TRouter>(`http://localhost:3000/${namespace}`);
    },

    ...db,
    ...cache,
    ...storage,
  };

  // @ts-expect-error
  return result; // Type assertion needed due to conditional return type
}

// Updated GnModule type with full option support
export type GnModule<
  TNamespace extends string = string,
  StorageKeys extends Array<string> | undefined = undefined,
  TConfig extends ModuleConfig<StorageKeys> = ModuleConfig<StorageKeys>,
> = ModuleWithOptions<
  TNamespace,
  TConfig extends { db: "postgres" } ? true : false,
  TConfig extends { cache: "redis" } ? true : false,
  TConfig["storage"]
>;

// Helper functions
async function createPostgresConnection(namespace: string) {
  const dbEnv = getPostgresEnv(namespace);
  const { default: pg } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  return drizzle(new pg.Pool({ connectionString: dbEnv.url }));
}

async function createRedisConnection(namespace: string) {
  const redisEnv = getRedisEnv(namespace);
  const { Redis } = await import("ioredis");
  return new Redis(redisEnv);
}

async function createS3Connection(namespace: string, storageName: string) {
  const s3Env = getS3Env(namespace, storageName);
  const { createS3Client } = await import("@core/helpers/s3.js");
  return createS3Client(s3Env);
}

async function check(key: string, fn: () => Promise<boolean> | boolean) {
  const startTime = process.hrtime();
  const success = await fn();
  const elapsedTime = process.hrtime(startTime);
  const elapsedMS = (elapsedTime[0] * 1e9 + elapsedTime[1]) / 1e6;
  return {
    [key]: {
      status: success ? ("alive" as const) : ("dead" as const),
      latency: elapsedMS,
    },
  };
}
