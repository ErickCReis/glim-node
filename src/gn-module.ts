import type {
  FeatureConfigShape,
  FeatureResultMap,
  ResolvedFeatureConfigMap,
} from "@core/_internal/features";
import { createModuleWithRuntime } from "@core/_internal/gn-factory";
import type { ImAliveFn } from "@core/_internal/im-alive";
import type { cacheRequest } from "@core/helpers/cache-request";
import type { coreEnv } from "@core/helpers/env";
import type { Logger } from "@core/helpers/logger";
import type { Context, Hono } from "hono";
import type { hc } from "hono/client";

type DropFirst<T extends unknown[]> = T extends [unknown, ...infer U] ? U : never;

export type BaseModule<TNamespace extends string = string> = {
  namespace: TNamespace;
  env: typeof coreEnv;
  logger: Logger;
  imAlive: ImAliveFn;

  "~context": Context | null;
  "~router": Hono | null;
  loadRouter: <TRouter extends Hono, Thc extends typeof hc<TRouter> = typeof hc<TRouter>>(
    router: TRouter,
  ) => (...args: Parameters<Thc>) => ReturnType<Thc>;

  invalidateCacheMiddleware: (
    ...patterns: DropFirst<Parameters<(typeof cacheRequest)["invalidate"]>>
  ) => Promise<void>;
  invalidateCacheMiddlewareByUser: (
    ...patterns: DropFirst<Parameters<(typeof cacheRequest)["invalidate"]>>
  ) => Promise<void>;
};

export type ModuleConfigShape<TConfig extends Record<string, unknown>> = FeatureConfigShape<
  TConfig,
  keyof BaseModule
>;
export type ModuleResult<TConfig extends Record<string, unknown>> = FeatureResultMap<TConfig>;
export type GnModule<
  TNamespace extends string = string,
  TConfig extends Record<string, unknown> = Record<never, never>,
> = BaseModule<TNamespace> & ModuleResult<TConfig>;
export type AnyGnModule = BaseModule<string>;

export async function createModule<
  const Namespace extends string,
  const Config extends Record<string, unknown>,
>(
  namespace: Namespace,
  config: Config & ModuleConfigShape<Config>,
): Promise<GnModule<Namespace, Config>> {
  return createModuleWithRuntime(namespace, config as ResolvedFeatureConfigMap<Config>) as Promise<
    GnModule<Namespace, Config>
  >;
}
