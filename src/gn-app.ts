import type {
  FeatureConfigShape,
  FeatureResultMap,
  ResolvedFeatureConfigMap,
} from "@core/_internal/features";
import { createAppWithRuntime } from "@core/_internal/gn-factory";
import type { ImAliveFn } from "@core/_internal/im-alive";
import type { cacheRequest } from "@core/helpers/cache-request";
import type { coreEnv } from "@core/helpers/env";
import type { Logger } from "@core/helpers/logger";
import type { Context, Hono } from "hono";
import type { hc } from "hono/client";

type DropFirst<T extends unknown[]> = T extends [unknown, ...infer U] ? U : never;

export type BaseApp = {
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

export type AppConfigShape<TConfig extends Record<string, unknown>> = FeatureConfigShape<
  TConfig,
  keyof BaseApp
>;
export type AppResult<TConfig extends Record<string, unknown>> = FeatureResultMap<TConfig>;
export type GnApp<TConfig extends Record<string, unknown> = Record<never, never>> = BaseApp &
  AppResult<TConfig>;
export type AnyGnApp = BaseApp;

export async function createApp<const Config extends Record<string, unknown>>(
  config: Config & AppConfigShape<Config>,
): Promise<GnApp<Config>> {
  return createAppWithRuntime(config as ResolvedFeatureConfigMap<Config>) as Promise<GnApp<Config>>;
}
