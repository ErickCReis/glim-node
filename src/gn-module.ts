import fs from "node:fs";
import { join } from "node:path";
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
  imAlive: (
    resource: "all" | "db" | "cache" | "storage",
    force: boolean,
  ) => Promise<Record<string, ImAlive> | ["OK"]>;

  _router: Hono | null;
  loadRouter<
    // biome-ignore lint/suspicious/noExplicitAny:
    TRouter extends Hono<any, any, any>,
    Thc extends typeof hc<TRouter> = typeof hc<TRouter>,
  >(router: TRouter): (...args: Parameters<Thc>) => ReturnType<Thc>;
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

  async function imAlive(
    resource: "all" | "db" | "cache" | "storage" = "all",
    force = false,
  ) {
    const logFileName = `im-alive${resource !== "all" ? `.${resource}` : ""}.log`;
    const logPath = join(process.cwd(), logFileName);

    // Check if log exists and return early if not forced
    if (!force && fs.existsSync(logPath)) {
      fs.appendFileSync(logPath, `${Date.now()}\n`);
      return ["OK"] as const;
    }

    const checksPromises = [];

    if ((resource === "all" || resource === "db") && db.db) {
      checksPromises.push(
        check(`db.${namespace}`, () =>
          db.db
            .execute("SELECT 1")
            .then((r) => r.rowCount === 1)
            .catch(() => false),
        ),
      );
    }

    if ((resource === "all" || resource === "cache") && cache.cache) {
      checksPromises.push(
        check(`cache.${namespace}`, () =>
          cache.cache.ping().then((r) => r === "PONG"),
        ),
      );
    }

    if ((resource === "all" || resource === "storage") && storage.storage) {
      for (const [key, value] of Object.entries(storage.storage)) {
        checksPromises.push(
          check(`storage.${namespace}.${key}`, () =>
            value
              .listBuckets()
              .then(() => true)
              .catch(() => false),
          ),
        );
      }
    }

    const results = await Promise.all(checksPromises);
    const res: Record<string, ImAlive> = {};
    for (const r of results) Object.assign(res, r);

    const allAlive = Object.values(res).every((r) => r.status === "alive");

    if (allAlive) {
      fs.appendFileSync(logPath, `${Date.now()}\n`);
    }

    return res;
  }

  const result = {
    namespace,
    env: coreEnv,
    logger: createLogger(namespace),
    imAlive,
    _router: null as unknown as Hono,
    loadRouter(router: Hono) {
      this._router = new Hono({ strict: false })
        .basePath(namespace)
        .route("/", router);
      return (...args: Parameters<typeof hc>) => {
        const basePath = args[0].endsWith("/") ? args[0] : `${args[0]}/`;
        args[0] = `${basePath}${namespace}`;
        return hc(...args);
      };
    },

    ...db,
    ...cache,
    ...storage,
  };

  // @ts-expect-error
  return result;
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
  const [elapsedTimeSec, elapsedTimeNano] = process.hrtime(startTime);
  const elapsed = (elapsedTimeSec * 1e9 + elapsedTimeNano / 1e9).toPrecision(6);
  return {
    [key]: {
      status: success ? ("alive" as const) : ("dead" as const),
      latency: elapsed,
    },
  };
}
