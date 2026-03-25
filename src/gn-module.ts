import type {
  FeatureConfig,
  FeatureConfigReturn,
} from "@core/_internal/features";
import { createModuleWithRuntime } from "@core/_internal/gn-factory";
import type { ImAliveFn } from "@core/_internal/im-alive";
import type { cacheRequest } from "@core/helpers/cache-request";
import type { coreEnv } from "@core/helpers/env";
import type { Logger } from "@core/helpers/logger";
import type { Context, Hono } from "hono";
import type { hc } from "hono/client";

type DropFirst<T extends unknown[]> = T extends [unknown, ...infer U]
  ? U
  : never;

export type BaseModule<TNamespace extends string = string> = {
  namespace: TNamespace;
  env: typeof coreEnv;
  logger: Logger;
  imAlive: ImAliveFn;

  "~context": Context | null;
  "~router": Hono | null;
  loadRouter: <
    TRouter extends Hono,
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

// Type for the module configuration
type ModuleConfig = {
  [key: string]: FeatureConfig;
} & {
  [K in keyof BaseModule]?: never;
};

// Get the return type for a specific feature config
type ConfigReturnType<T extends FeatureConfig> = FeatureConfigReturn<T>;

// Type for the result after processing
type ModuleResult<T extends ModuleConfig> = {
  [K in keyof T]: ConfigReturnType<T[K]>;
};

export async function createModule<
  const Namespace extends string,
  const Config extends ModuleConfig,
>(
  namespace: Namespace,
  config: Config,
): Promise<BaseModule<Namespace> & ModuleResult<Config>> {
  return createModuleWithRuntime(namespace, config) as Promise<
    BaseModule<Namespace> & ModuleResult<Config>
  >;
}

export type GnModule = Awaited<ReturnType<typeof createModule>>;
