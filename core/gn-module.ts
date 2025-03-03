import { type Logger, createLogger } from "@core/utils/logger.js";
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

const envOptions = ["local", "development", "staging", "production"] as const;
const envOptionsMap = {
  production: "PRD",
  staging: "STG",
  development: "DEV",
  local: "DEV",
} as const satisfies Record<(typeof envOptions)[number], string>;

export const mainEnv = z
  .object({
    APP_NAME: z.string(),
    APP_ENV: z
      .enum(["local", "development", "staging", "production"])
      .transform((v) => envOptionsMap[v]),
    APP_CORS_ORIGIN: z.string().optional().default("*"),
  })
  .parse(process.env);

// Define config type that allows for partial configuration
type ModuleConfig<TStorageKeys extends ReadonlyArray<string> | undefined> = {
  db?: "postgres";
  cache?: "redis";
  storage?: TStorageKeys;
};

// Define base module without optional components
type BaseModule<TNamespace extends string> = {
  namespace: TNamespace;
  env: typeof mainEnv;
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
  StorageKeys extends ReadonlyArray<string> | undefined = undefined,
> = BaseModule<TNamespace> &
  (HasDB extends true ? { db: ReturnType<typeof drizzleCache> } : EmptyObject) &
  (HasCache extends true ? { cache: typeof redisCache } : EmptyObject) &
  (StorageKeys extends undefined
    ? EmptyObject
    : {
        storage: {
          [K in StorageKeys extends ReadonlyArray<infer U>
            ? U
            : never]: ReturnType<typeof s3Cache>;
        };
      });

// Implementation with proper type handling
export async function createModule<
  TNamespace extends string,
  StorageKeys extends ReadonlyArray<string> | undefined,
  TConfig extends ModuleConfig<StorageKeys>,
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
  // Create base module
  const baseModule: BaseModule<TNamespace> = {
    namespace,
    env: mainEnv,
    logger: createLogger(namespace),
    _router: null as unknown as Hono,
    loadRouter<TRouter extends Hono>(router: TRouter) {
      this._router = new Hono().basePath(namespace).route("", router);
      return hc<TRouter>(`http://localhost:3000/${namespace}`);
    },
  };

  // Add database if configured
  const moduleWithDb =
    config?.db === "postgres"
      ? { ...baseModule, db: await createPostgresConnection(namespace) }
      : baseModule;

  // Add cache if configured
  const moduleWithCache =
    config?.cache === "redis"
      ? { ...moduleWithDb, cache: await createRedisConnection(namespace) }
      : moduleWithDb;

  // Add storages if configured
  const storages = await Promise.all(
    (config?.storage ?? []).map((s) => createS3Connection(s)),
  );

  const moduleWithStorage =
    (config?.storage?.length ?? 0) > 0
      ? {
          ...moduleWithCache,
          storage: config?.storage?.reduce(
            (acc, s, i) => {
              // biome-ignore lint/style/noNonNullAssertion: <explanation>
              acc[s] = storages[i]!;
              return acc;
            },
            {} as Record<string, ReturnType<typeof s3Cache>>,
          ),
        }
      : moduleWithCache;

  // @ts-expect-error
  return moduleWithStorage; // Type assertion needed due to conditional return type
}

// Updated GnModule type with full option support
export type GnModule<
  TNamespace extends string = string,
  StorageKeys extends ReadonlyArray<string> | undefined = undefined,
  TConfig extends ModuleConfig<StorageKeys> = ModuleConfig<StorageKeys>,
> = ModuleWithOptions<
  TNamespace,
  TConfig extends { db: "postgres" } ? true : false,
  TConfig extends { cache: "redis" } ? true : false,
  TConfig["storage"]
>;

// Helper functions

async function createPostgresConnection(namespace: string) {
  const upperNamespace = namespace.replaceAll("-", "_").toUpperCase();
  const dbEnv = z
    .object({
      [`DB_${upperNamespace}_HOST`]: z.string(),
      [`DB_${upperNamespace}_DATABASE`]: z.string(),
      [`DB_${upperNamespace}_USERNAME`]: z.string(),
      [`DB_${upperNamespace}_PASSWORD`]: z.string(),
    })
    .parse(process.env);

  const host = dbEnv[`DB_${upperNamespace}_HOST`];
  const database = dbEnv[`DB_${upperNamespace}_DATABASE`];
  const username = dbEnv[`DB_${upperNamespace}_USERNAME`];
  const password = dbEnv[`DB_${upperNamespace}_PASSWORD`];
  const connectionString = `postgresql://${username}:${password}@${host}/${database}`;

  if (!pgCache) {
    pgCache = (await import("pg")).default;
  }

  if (!drizzleCache) {
    drizzleCache = (await import("drizzle-orm/node-postgres")).drizzle;
  }

  return drizzleCache(new pgCache.Pool({ connectionString }));
}

async function createRedisConnection(namespace: string) {
  const upperNamespace = namespace.replaceAll("-", "_").toUpperCase();
  const redisEnv = z
    .object({
      [`CACHE_${upperNamespace}_HOST`]: z.string(),
      [`CACHE_${upperNamespace}_PORT`]: z.coerce.number(),
    })
    .parse(process.env);

  const host = redisEnv[`CACHE_${upperNamespace}_HOST`] as string;
  const port = redisEnv[`CACHE_${upperNamespace}_PORT`] as number | undefined;

  if (!redisCache) {
    redisCache = (await import("ioredis")).Redis;
  }

  return new redisCache({ host, port });
}

async function createS3Connection(storageName: string) {
  const s3Env = z
    .object({
      [`S3_${storageName}_REGION`]: z.string(),
      [`S3_${storageName}_BUCKET`]: z.string(),
      [`S3_${storageName}_ENDPOINT`]: z.string().optional(),
      [`S3_${storageName}_ACCESS_KEY`]: z.string(),
      [`S3_${storageName}_SECRET_KEY`]: z.string(),
    })
    .parse(process.env);

  const region = s3Env[`S3_${storageName}_REGION`] as string;
  const bucket = s3Env[`S3_${storageName}_BUCKET`] as string;
  const endpoint = s3Env[`S3_${storageName}_ENDPOINT`];
  const accessKeyId = s3Env[`S3_${storageName}_ACCESS_KEY`] as string;
  const secretAccessKey = s3Env[`S3_${storageName}_SECRET_KEY`] as string;

  if (!s3Cache) {
    s3Cache = (await import("@core/helpers/s3.js")).createS3Client;
  }

  return s3Cache({
    region,
    bucket,
    endpoint,
    accessKeyId,
    secretAccessKey,
  });
}
