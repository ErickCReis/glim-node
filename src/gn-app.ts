import {
  type Feature,
  type FeatureConfig,
  type FeatureImAlive,
  type FeatureReturn,
  createFeature,
} from "@core/_internal/features";
import { type ImAliveFn, createImAlive } from "@core/_internal/im-alive";
import { cacheRequest } from "@core/helpers/cache-request";
import { coreEnv } from "@core/helpers/env";
import { type Logger, createLogger } from "@core/helpers/logger";
import type { Context } from "hono";

import { Hono } from "hono";
import { hc } from "hono/client";

type DropFirst<T extends unknown[]> = T extends [any, ...infer U] ? U : never;

export type BaseApp = {
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

// Type for the app configuration
type AppConfig = {
  [key: string]: FeatureConfig;
} & {
  [K in keyof BaseApp]?: never;
};

// Get the return type for a specific feature config
type ConfigReturnType<T extends FeatureConfig> = T extends {
  type: infer K extends Feature;
}
  ? FeatureReturn<K>
  : never;

// Type for the result after processing
type AppResult<T extends AppConfig> = {
  [K in keyof T]: ConfigReturnType<T[K]>;
};

export async function createApp<const Config extends AppConfig>(
  config: Config,
): Promise<BaseApp & AppResult<Config>> {
  const base: BaseApp = {
    env: coreEnv,
    logger: createLogger(),

    "~router": null as unknown as Hono,
    // @ts-expect-error
    loadRouter(router: Hono) {
      this["~router"] = new Hono({ strict: false }).route("/", router);
      return (...args: Parameters<typeof hc>) => {
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

  const features = {} as Record<string, FeatureReturn<Feature>>;

  for (const [key, value] of Object.entries(config)) {
    const [featureType] = value.type.split(".");
    const alias = key === featureType ? "default" : key;
    features[key] = await createFeature(
      value.type,
      // @ts-expect-error
      value.config,
      base,
      alias,
    );
  }

  // @ts-expect-error
  return Object.assign(base, {
    imAlive: createImAlive(
      "app",
      Object.entries(config).reduce(
        (acc, [key, value]) => {
          acc[key] = {
            type: value.type,
            // @ts-expect-error
            driver: features[key],
          };

          return acc;
        },
        {} as Record<string, FeatureImAlive>,
      ),
    ),

    ...features,
  });
}

export type GnApp = Awaited<ReturnType<typeof createApp>>;
