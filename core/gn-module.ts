import { createLogger } from "@core/utils/logger.js";
import { Hono } from "hono";
import { hc } from "hono/client";
import { z } from "zod";

// Import cache
let pgCache: typeof import("pg");
let drizzleCache: typeof import("drizzle-orm/node-postgres").drizzle;
let redisCache: typeof import("ioredis").Redis;

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
type ModuleConfig = {
  db?: "postgres";
  cache?: "redis";
};

// Define base module without optional components
type BaseModule<TNamespace extends string> = {
  namespace: TNamespace;
  env: typeof mainEnv;
  logger: ReturnType<typeof createLogger>;
  _router: null | Hono;
  loadRouter<TRouter extends Hono>(
    router: TRouter,
  ): ReturnType<typeof hc<TRouter>>;
};

// Define return types based on configuration
type ModuleWithOptions<
  TNamespace extends string,
  HasDB extends boolean = false,
  HasCache extends boolean = false,
> = BaseModule<TNamespace> &
  (HasDB extends true ? { db: ReturnType<typeof drizzleCache> } : EmptyObject) &
  (HasCache extends true ? { cache: typeof redisCache } : EmptyObject);

// Implementation with proper type handling
export async function createModule<
  TNamespace extends string,
  TConfig extends ModuleConfig = ModuleConfig,
>(
  namespace: TNamespace,
  config?: TConfig,
): Promise<
  ModuleWithOptions<
    TNamespace,
    TConfig extends { db: "postgres" } ? true : false,
    TConfig extends { cache: "redis" } ? true : false
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

  // @ts-expect-error
  return moduleWithCache; // Type assertion needed due to conditional return type
}

// Updated GnModule type with full option support
export type GnModule<
  TNamespace extends string = string,
  TConfig extends ModuleConfig = ModuleConfig,
> = ModuleWithOptions<
  TNamespace,
  TConfig extends { db: "postgres" } ? true : false,
  TConfig extends { cache: "redis" } ? true : false
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
