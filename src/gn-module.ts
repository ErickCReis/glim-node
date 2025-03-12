import {
  type FeatureDriver,
  type FeatureDriverMap,
  type FeatureDriverType,
  createConnection,
} from "@core/_internal/features";
import { type ImAliveFn, createImAlive } from "@core/_internal/im-alive";
import { coreEnv } from "@core/helpers/env.js";
import { type Logger, createLogger } from "@core/helpers/logger.js";
import { Hono } from "hono";
import { hc } from "hono/client";

// biome-ignore lint/complexity/noBannedTypes:
type EmptyObject = {};

type ModuleConfig<TStorageKeys extends Array<string> | undefined> = {
  db?: FeatureDriver<"db">;
  cache?: FeatureDriver<"cache">;
  storage?: TStorageKeys;
};

type BaseModule<TNamespace extends string> = {
  namespace: TNamespace;
  env: typeof coreEnv;
  logger: Logger;
  imAlive: ImAliveFn;

  _router: Hono | null;
  loadRouter: <
    // biome-ignore lint/suspicious/noExplicitAny:
    TRouter extends Hono<any, any, any>,
    Thc extends typeof hc<TRouter> = typeof hc<TRouter>,
  >(
    router: TRouter,
  ) => (...args: Parameters<Thc>) => ReturnType<Thc>;
};

type ModuleWithOptions<
  TNamespace extends string,
  HasDB extends boolean = false,
  HasCache extends boolean = false,
  StorageKeys extends Array<string> | undefined = undefined,
> = BaseModule<TNamespace> &
  (HasDB extends true
    ? { db: FeatureDriverType<"db", "postgres"> }
    : EmptyObject) &
  (HasCache extends true
    ? { cache: FeatureDriverType<"cache", "redis"> }
    : EmptyObject) &
  (StorageKeys extends undefined
    ? EmptyObject
    : {
        storage: {
          [K in StorageKeys extends Array<infer U>
            ? U
            : never]: FeatureDriverType<"storage", "s3">[string];
        };
      });

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
    TConfig extends FeatureDriverMap<"db"> ? true : false,
    TConfig extends FeatureDriverMap<"cache"> ? true : false,
    TConfig["storage"]
  >
> {
  const db =
    config?.db === "postgres"
      ? { db: await createConnection.postgres(namespace) }
      : {};

  const cache =
    config?.cache === "redis"
      ? { cache: await createConnection.redis(namespace) }
      : {};

  const storages = await Promise.all(
    (config?.storage ?? []).map(async (s) => {
      return {
        name: s,
        storage: await createConnection.s3(namespace, s),
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
            {} as FeatureDriverType<"storage", "s3">,
          ),
        }
      : {};

  const resources = {
    db: {
      postgres: db.db,
    },
    cache: {
      redis: cache.cache,
    },
    storage: {
      s3: storage.storage,
    },
  };

  const result = {
    namespace,
    env: coreEnv,
    logger: createLogger(namespace),
    imAlive: createImAlive(namespace, resources),
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

export type GnModule = Awaited<ReturnType<typeof createModule>>;
