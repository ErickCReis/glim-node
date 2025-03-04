import {
  coreEnv,
  getPostgresEnv,
  getRedisEnv,
  getS3Env,
} from "@core/helpers/env.js";
import { type Logger, createLogger } from "@core/helpers/logger.js";
import { Hono } from "hono";
import { hc } from "hono/client";
import { z } from "zod";

// Import cache
let pgCache: typeof import("pg");
let drizzleCache: typeof import("drizzle-orm/node-postgres").drizzle;
let redisCache: typeof import("ioredis").Redis;
let s3Cache: typeof import("@core/helpers/s3.js").createS3Client;

// biome-ignore lint/complexity/noBannedTypes:
type EmptyObject = {};

// Define config type that allows for partial configuration
type ModuleConfig<TStorageKeys extends Array<string> | undefined> = {
  db?: "postgres";
  cache?: "redis";
  storage?: TStorageKeys;
};

// Define base module without optional components
type BaseModule<TNamespace extends string> = {
  namespace: TNamespace;
  env: typeof coreEnv;
  logger: Logger;
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
  (HasDB extends true ? { db: ReturnType<typeof drizzleCache> } : EmptyObject) &
  (HasCache extends true ? { cache: typeof redisCache } : EmptyObject) &
  (StorageKeys extends undefined
    ? EmptyObject
    : {
        storage: {
          [K in StorageKeys extends Array<infer U> ? U : never]: ReturnType<
            typeof s3Cache
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
            {} as Record<string, ReturnType<typeof s3Cache>>,
          ),
        }
      : {};

  const result = {
    namespace,
    env: coreEnv,
    logger: createLogger(namespace),
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

  if (!pgCache) {
    pgCache = (await import("pg")).default;
  }

  if (!drizzleCache) {
    drizzleCache = (await import("drizzle-orm/node-postgres")).drizzle;
  }

  return drizzleCache(new pgCache.Pool({ connectionString: dbEnv.url }));
}

async function createRedisConnection(namespace: string) {
  const redisEnv = getRedisEnv(namespace);

  if (!redisCache) {
    redisCache = (await import("ioredis")).Redis;
  }

  return new redisCache(redisEnv);
}

async function createS3Connection(namespace: string, storageName: string) {
  const s3Env = getS3Env(namespace, storageName);

  if (!s3Cache) {
    s3Cache = (await import("@core/helpers/s3.js")).createS3Client;
  }

  return s3Cache(s3Env);
}
