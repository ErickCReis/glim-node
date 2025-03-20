import type { BaseModule } from "@core/gn-module";
import {
  getHttpEnv,
  getPostgresEnv,
  getRedisEnv,
  getS3Env,
} from "@core/helpers/env";

const featureConfig = {
  db: {
    async postgres(module: BaseModule, key = "default") {
      const dbEnv = getPostgresEnv(module.namespace);
      const { default: pg } = await import("pg");
      const { drizzle } = await import("drizzle-orm/node-postgres");
      return drizzle(new pg.Pool({ connectionString: dbEnv.url }));
    },
  },
  cache: {
    async redis(module: BaseModule, key = "default") {
      const redisEnv = getRedisEnv(module.namespace);
      const { createRedisClient } = await import("@core/helpers/redis");
      return createRedisClient(redisEnv);
    },
  },
  storage: {
    async s3(module: BaseModule, key = "default") {
      const s3Env = getS3Env(module.namespace, key);
      const { createS3Client } = await import("@core/helpers/s3");
      return createS3Client(s3Env);
    },
  },
  http: {
    async webservice(module: BaseModule, key = "default") {
      const httpEnv = getHttpEnv(module.namespace, key);
      const { createHttpClient } = await import("@core/helpers/http");
      return createHttpClient(httpEnv);
    },
    async bifrost(module: BaseModule, key = "default") {
      const httpEnv = getHttpEnv(module.namespace, key);
      const { createBifrostClient } = await import("@core/helpers/http");
      return createBifrostClient({
        ...httpEnv,
        getAuth: () => module["~context"]?.var.auth.id,
      });
    },
  },
} as const;

export type FeatureConfig = typeof featureConfig;
export type Feature = keyof FeatureConfig & {};
export type FeatureDriver<F extends Feature> = keyof FeatureConfig[F];
export type FeatureDriverMap<F extends Feature> = Record<F, FeatureDriver<F>>;

export type FeatureDriverType<
  F extends Feature = Feature,
  D extends FeatureDriver<F> = FeatureDriver<F>,
  // @ts-expect-error
> = Awaited<ReturnType<FeatureConfig[F][D]>>;

export function createDriver<F extends Feature, D extends FeatureDriver<F>>(
  baseModule: BaseModule,
  key: string,
  feature: F,
  driver: D,
): Promise<FeatureDriverType<F, D>> {
  // @ts-expect-error
  return featureConfig[feature][driver](baseModule, key);
}
