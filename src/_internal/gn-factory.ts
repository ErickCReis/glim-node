import {
  createFeature,
  type Feature,
  type FeatureConfig,
  type FeatureImAlive,
  type FeatureReturn,
} from "@core/_internal/features";
import { createImAlive, type ImAliveFn } from "@core/_internal/im-alive";
import { cacheRequest } from "@core/helpers/cache-request";
import { coreEnv } from "@core/helpers/env";
import { createLogger, type Logger } from "@core/helpers/logger";
import type { Context } from "hono";
import { Hono } from "hono";
import { hc } from "hono/client";

type DropFirst<T extends unknown[]> = T extends [unknown, ...infer U] ? U : never;

type GnFactoryRuntime = {
  createFeature?: typeof createFeature;
  createImAlive?: typeof createImAlive;
  createLogger?: typeof createLogger;
};

type GnBase = {
  env: typeof coreEnv;
  logger: Logger;
  imAlive: ImAliveFn;

  "~context": Context | null;
  "~router": Hono | null;
  loadRouter: (router: Hono) => (...args: Parameters<typeof hc>) => ReturnType<typeof hc>;

  invalidateCacheMiddleware: (
    ...patterns: DropFirst<Parameters<(typeof cacheRequest)["invalidate"]>>
  ) => Promise<void>;
  invalidateCacheMiddlewareByUser: (
    ...patterns: DropFirst<Parameters<(typeof cacheRequest)["invalidate"]>>
  ) => Promise<void>;
};

type ConfigReturnType<T extends FeatureConfig> = T extends {
  type: infer K extends Feature;
}
  ? FeatureReturn<K>
  : never;

type FactoryResult<TConfig extends Record<string, FeatureConfig>> = {
  [K in keyof TConfig]: ConfigReturnType<TConfig[K]>;
};

function resolveRuntime(runtime: GnFactoryRuntime = {}) {
  return {
    createFeature: runtime.createFeature ?? createFeature,
    createImAlive: runtime.createImAlive ?? createImAlive,
    createLogger: runtime.createLogger ?? createLogger,
  };
}

function createBase(namespace: string | undefined, runtime: ReturnType<typeof resolveRuntime>) {
  const base: GnBase & { namespace?: string } = {
    env: coreEnv,
    logger: runtime.createLogger(namespace),
    imAlive: async () => ({}) as never,

    "~context": null,
    "~router": null,
    loadRouter(router: Hono) {
      this["~router"] = namespace
        ? new Hono({ strict: false }).basePath(namespace).route("/", router)
        : new Hono({ strict: false }).route("/", router);

      return (...args: Parameters<typeof hc>) => {
        if (namespace) {
          const basePath = args[0].endsWith("/") ? args[0] : `${args[0]}/`;
          args[0] = `${basePath}${namespace}`;
        }

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

  if (namespace) {
    base.namespace = namespace;
  }

  return base;
}

async function resolveFeatures<const TConfig extends Record<string, FeatureConfig>>(
  config: TConfig,
  base: GnBase & { namespace?: string },
  runtime: ReturnType<typeof resolveRuntime>,
) {
  const features = {} as FactoryResult<TConfig>;
  const imAliveFeatures = {} as Record<string, FeatureImAlive>;

  for (const [key, value] of Object.entries(config) as Array<
    [keyof TConfig & string, TConfig[keyof TConfig]]
  >) {
    const [featureType] = value.type.split(".");
    const alias = key === featureType ? "default" : key;
    const driver = await runtime.createFeature(
      value.type,
      value.config as never,
      base as never,
      alias,
    );

    features[key] = driver as FactoryResult<TConfig>[typeof key];
    imAliveFeatures[key] = {
      type: value.type,
      driver: driver as FeatureReturn<Feature>,
    } as FeatureImAlive;
  }

  return { features, imAliveFeatures };
}

export async function createAppWithRuntime<const TConfig extends Record<string, FeatureConfig>>(
  config: TConfig,
  runtime: GnFactoryRuntime = {},
) {
  const resolvedRuntime = resolveRuntime(runtime);
  const base = createBase(undefined, resolvedRuntime);
  const { features, imAliveFeatures } = await resolveFeatures(config, base, resolvedRuntime);

  return Object.assign(base, {
    imAlive: resolvedRuntime.createImAlive("app", imAliveFeatures),
    ...features,
  }) as GnBase & FactoryResult<TConfig>;
}

export async function createModuleWithRuntime<
  const TNamespace extends string,
  const TConfig extends Record<string, FeatureConfig>,
>(namespace: TNamespace, config: TConfig, runtime: GnFactoryRuntime = {}) {
  const resolvedRuntime = resolveRuntime(runtime);
  const base = createBase(namespace, resolvedRuntime);
  const { features, imAliveFeatures } = await resolveFeatures(config, base, resolvedRuntime);

  return Object.assign(base, {
    namespace,
    imAlive: resolvedRuntime.createImAlive(namespace, imAliveFeatures),
    ...features,
  }) as GnBase & { namespace: TNamespace } & FactoryResult<TConfig>;
}
