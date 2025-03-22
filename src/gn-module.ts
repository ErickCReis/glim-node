import {
  type Feature,
  type FeatureDriver,
  type FeatureDriverType,
  createDriver,
} from "@core/_internal/features";
import { type ImAliveFn, createImAlive } from "@core/_internal/im-alive";
import { cacheRequest } from "@core/helpers/cache-request";
import { coreEnv } from "@core/helpers/env";
import { type Logger, createLogger } from "@core/helpers/logger";
import type { createSNSClient } from "@core/helpers/sns";
import type { Context } from "hono";

import { Hono } from "hono";
import { hc } from "hono/client";

type EmptyObject = Record<string, never>;

type ModuleConfigItem<
  F extends Feature,
  Keys extends ReadonlyArray<string> | undefined,
> = Keys extends undefined
  ? EmptyObject
  : F extends "notification"
    ? {
        [K in Keys extends ReadonlyArray<infer U> ? U : never]: {
          driver: FeatureDriver<F>;
          topics: Keys;
        };
      }
    : {
        [K in Keys extends ReadonlyArray<infer U>
          ? U
          : never]: FeatureDriver<F>;
      };

type ModuleConfigItemWithDefault<
  F extends Feature,
  Keys extends ReadonlyArray<string> | undefined,
> = {
  default?: FeatureDriver<F>;
} & ModuleConfigItem<F, Keys>;

type ModuleConfig<
  DbKeys extends ReadonlyArray<string> | undefined,
  CacheKeys extends ReadonlyArray<string> | undefined,
  StorageKeys extends ReadonlyArray<string> | undefined,
  HttpClientKeys extends ReadonlyArray<string> | undefined,
  NotificationKeys extends ReadonlyArray<string> | undefined,
> = {
  db?: ModuleConfigItemWithDefault<"db", DbKeys>;
  cache?: ModuleConfigItemWithDefault<"cache", CacheKeys>;
  storage?: ModuleConfigItemWithDefault<"storage", StorageKeys>;
  http?: ModuleConfigItem<"http", HttpClientKeys>;
  notification?: ModuleConfigItem<"notification", NotificationKeys>;
};

type DropFirst<T extends unknown[]> = T extends [any, ...infer U] ? U : never;

export type BaseModule<TNamespace extends string = string> = {
  namespace: TNamespace;
  env: typeof coreEnv;
  logger: Logger;
  imAlive: ImAliveFn;

  "~context": Context | null;
  "~router": Hono | null;
  loadRouter: <
    TRouter extends Hono<any, any, any>,
    Thc extends typeof hc<TRouter> = typeof hc<TRouter>,
  >(
    router: TRouter,
  ) => (...args: Parameters<Thc>) => ReturnType<Thc>;

  invalidateCacheMiddleware: (
    ...patterns: DropFirst<Parameters<(typeof cacheRequest)["invalidate"]>>
  ) => Promise<void>;
  invalidateCacheMiddlewareByUser: (
    ...patterns: DropFirst<Parameters<(typeof cacheRequest)["invalidate"]>>
  ) => Promise<void>;
};

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;

type ModuleInstance<T extends ModuleConfig<any, any, any, any, any>> = {
  [K in keyof T & Feature]: (T[K] extends {
    default: infer Driver extends FeatureDriver<K>;
  }
    ? { [P in K]: FeatureDriverType<K, Driver> }
    : EmptyObject) & {
    [SubKey in keyof T[K] & string as SubKey extends "default"
      ? never
      : `${K}${Capitalize<SubKey>}`]: T[K] extends Record<SubKey, infer Driver>
      ? Driver extends FeatureDriver<K>
        ? FeatureDriverType<K, Driver>
        : never
      : never;
  };
}[keyof T & Feature];

export async function createModule<
  const Namespace extends string,
  const DbKeys extends ReadonlyArray<string> | undefined,
  const CacheKeys extends ReadonlyArray<string> | undefined,
  const StorageKeys extends ReadonlyArray<string> | undefined,
  const HttpClientKeys extends ReadonlyArray<string> | undefined,
  const NotificationKeys extends ReadonlyArray<string> | undefined,
  const Config extends ModuleConfig<
    DbKeys,
    CacheKeys,
    StorageKeys,
    HttpClientKeys,
    NotificationKeys
  >,
>(
  namespace: Namespace,
  config: Config,
): Promise<
  BaseModule<Namespace> &
    UnionToIntersection<ModuleInstance<Config>> & {
      notification: Config["notification"] extends {
        [K in keyof Config["notification"] as K]: {
          driver: "sns";
          topics: infer Topics extends ReadonlyArray<string>;
        };
      }
        ? {
            [K in keyof Config["notification"]]: ReturnType<
              typeof createSNSClient<Topics>
            >;
          }
        : never;
    }
> {
  const base: BaseModule = {
    namespace,
    env: coreEnv,
    logger: createLogger(namespace),

    "~router": null as unknown as Hono,
    // @ts-expect-error
    loadRouter(router: Hono) {
      this["~router"] = new Hono({ strict: false })
        .basePath(namespace)
        .route("/", router);
      return (...args: Parameters<typeof hc>) => {
        const basePath = args[0].endsWith("/") ? args[0] : `${args[0]}/`;
        args[0] = `${basePath}${namespace}`;
        return hc(...args);
      };
    },

    async invalidateCacheMiddleware(...patterns) {
      const driver = this["~context"]?.var.driver;
      await cacheRequest.invalidate(driver, ...patterns);
    },
    async invalidateCacheMiddlewareByUser(...patterns) {
      const driver = this["~context"]?.var.driver;
      const userId = this["~context"]?.var.auth.id;
      await cacheRequest.invalidateByUser(driver, userId, ...patterns);
    },
  };

  async function processFeature<F extends Feature>(feature: F) {
    const featureResult: Record<string, any> = {};

    if (feature === "notification") {
      const notificationConfig = config.notification;
      if (!notificationConfig) {
        return featureResult;
      }

      featureResult.notification = {};

      for (const [name, config] of Object.entries(notificationConfig)) {
        featureResult.notification[name] = await createDriver(
          feature,
          // @ts-expect-error
          config.driver,
          base,
          "default",
          config.topics,
        );
      }

      return featureResult;
    }

    const featureConfig = config[feature];
    if (featureConfig?.default) {
      featureResult[feature] = await createDriver(
        feature,
        featureConfig.default as FeatureDriver<F>,
        // @ts-expect-error
        base,
        "default",
      );
    }

    const extraKeys = getExtraKeys(feature, config);
    for (const [subKey, driver] of Object.entries(extraKeys)) {
      const capitalizedSubKey =
        subKey.charAt(0).toUpperCase() + subKey.slice(1);
      featureResult[`${feature}${capitalizedSubKey}`] = await createDriver(
        feature,
        driver,
        // @ts-expect-error
        base,
        subKey,
      );
    }

    return featureResult;
  }

  const dbResult = await processFeature("db");
  const cacheResult = await processFeature("cache");
  const storageResult = await processFeature("storage");
  const notificationResult = await processFeature("notification");

  console.log({ notificationResult });

  const httpResult = await processFeature("http");

  // @ts-expect-error
  return Object.assign(base, {
    imAlive: createImAlive(namespace, {
      db: dbResult,
      cache: cacheResult,
      storage: storageResult,
      http: httpResult,
    }),

    ...dbResult,
    ...cacheResult,
    ...storageResult,
    ...notificationResult,
    ...httpResult,
  });
}

export type GnModule = Awaited<ReturnType<typeof createModule>>;

function getExtraKeys<F extends Feature>(
  feature: F,
  config: ModuleConfig<any, any, any, any, any> | undefined,
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
