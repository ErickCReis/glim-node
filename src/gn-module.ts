import {
  type Feature,
  type FeatureDriver,
  type FeatureDriverType,
  createDriver,
} from "@core/_internal/features";
import { type ImAliveFn, createImAlive } from "@core/_internal/im-alive";
import { type Logger, coreEnv, createLogger } from "@core/helpers";
import { invalidateCacheMiddleware } from "@core/helpers/cache-request";
import { Hono } from "hono";
import { hc } from "hono/client";

type EmptyObject = Record<string, never>;

type ModuleConfigItem<
  F extends Feature,
  Keys extends ReadonlyArray<string> | undefined,
> = {
  default?: FeatureDriver<F>;
} & (Keys extends undefined
  ? EmptyObject
  : {
      [K in Keys extends ReadonlyArray<infer U> ? U : never]: FeatureDriver<F>;
    });

type ModuleConfig<
  DbKeys extends ReadonlyArray<string> | undefined,
  CacheKeys extends ReadonlyArray<string> | undefined,
  StorageKeys extends ReadonlyArray<string> | undefined,
> = {
  db?: ModuleConfigItem<"db", DbKeys>;
  cache?: ModuleConfigItem<"cache", CacheKeys>;
  storage?: ModuleConfigItem<"storage", StorageKeys>;
};

type DropFirst<T extends unknown[]> = T extends [any, ...infer U] ? U : never;

type BaseModule<TNamespace extends string> = {
  namespace: TNamespace;
  env: typeof coreEnv;
  logger: Logger;
  imAlive: ImAliveFn;

  _router: Hono | null;
  loadRouter: <
    TRouter extends Hono<any, any, any>,
    Thc extends typeof hc<TRouter> = typeof hc<TRouter>,
  >(
    router: TRouter,
  ) => (...args: Parameters<Thc>) => ReturnType<Thc>;

  _cacheMiddlewareDriver: FeatureDriverType<"cache">;
  invalidateCacheMiddleware: <
    Client extends { $url: (arg: any) => URL; $get: (args: any) => any },
  >(
    ...patterns: DropFirst<Parameters<typeof invalidateCacheMiddleware<Client>>>
  ) => Promise<void>;
};

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;

type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

type ModuleInstance<T extends ModuleConfig<any, any, any>> = {
  [K in keyof T & string]: (T[K] extends {
    // @ts-expect-error
    default: infer Driver extends FeatureDriver<K>;
  }
    ? // @ts-expect-error
      { [P in K]: FeatureDriverType<K, Driver> }
    : EmptyObject) & {
    [SubKey in keyof T[K] & string as SubKey extends "default"
      ? never
      : `${K}${Capitalize<SubKey>}`]: T[K] extends Record<SubKey, infer Driver>
      ? // @ts-expect-error
        Driver extends FeatureDriver<K>
        ? // @ts-expect-error
          FeatureDriverType<K, Driver>
        : never
      : never;
  };
}[keyof T & string];

export async function createModule<
  const Namespace extends string,
  const DbKeys extends ReadonlyArray<string> | undefined,
  const CacheKeys extends ReadonlyArray<string> | undefined,
  const StorageKeys extends ReadonlyArray<string> | undefined,
  const Config extends ModuleConfig<DbKeys, CacheKeys, StorageKeys>,
>(
  namespace: Namespace,
  config: Config,
): Promise<
  Prettify<BaseModule<Namespace> & UnionToIntersection<ModuleInstance<Config>>>
> {
  async function processFeature<F extends Feature>(feature: F) {
    const featureResult: Record<string, FeatureDriverType<F>> = {};

    const featureConfig = config[feature];
    if (featureConfig?.default) {
      featureResult[feature] = await createDriver(
        feature,
        featureConfig.default as FeatureDriver<F>,
        namespace,
      );
    }

    const extraKeys = getExtraKeys(feature, config);
    for (const [subKey, driver] of Object.entries(extraKeys)) {
      const capitalizedSubKey =
        subKey.charAt(0).toUpperCase() + subKey.slice(1);
      featureResult[`${feature}${capitalizedSubKey}`] = await createDriver(
        feature,
        driver,
        namespace,
        subKey,
      );
    }

    return featureResult;
  }

  const dbResult = await processFeature("db");
  const cacheResult = await processFeature("cache");
  const storageResult = await processFeature("storage");

  const result: BaseModule<Namespace> = {
    namespace,
    env: coreEnv,
    logger: createLogger(namespace),

    _router: null as unknown as Hono,
    // @ts-expect-error
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

    async invalidateCacheMiddleware(...patterns) {
      if (!this._cacheMiddlewareDriver) {
        throw new Error("Cache middleware não está configurado");
      }
      await invalidateCacheMiddleware(this._cacheMiddlewareDriver, ...patterns);
    },

    imAlive: createImAlive(namespace, {
      db: dbResult,
      cache: cacheResult,
      storage: storageResult,
    }),

    ...dbResult,
    ...cacheResult,
    ...storageResult,
  };

  // @ts-expect-error
  return result;
}

export type GnModule = Awaited<ReturnType<typeof createModule>>;

function getExtraKeys<F extends Feature>(
  feature: F,
  config: ModuleConfig<any, any, any> | undefined,
): Record<string, FeatureDriver<F>> {
  if (!config || !config[feature]) {
    return {};
  }

  const extraKeys: Record<string, FeatureDriver<F>> = {};
  for (const [key, value] of Object.entries(config[feature])) {
    if (key !== "default") {
      extraKeys[key] = value as FeatureDriver<F>;
    }
  }
  return extraKeys;
}
