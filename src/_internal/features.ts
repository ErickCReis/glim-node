import type { BaseModule } from "@core/gn-module";
import {
  getHttpEnv,
  getPostgresEnv,
  getRedisEnv,
  getS3Env,
  getSNSEnv,
  getSNSTopicEnv,
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
  notification: {
    async sns<Topics extends ReadonlyArray<string>>(
      module: BaseModule,
      key: string,
      topics: Topics,
    ) {
      const snsEnv = getSNSEnv(module.namespace, key);

      const topicsArns = topics?.reduce(
        (acc, topic) => {
          acc[topic] = getSNSTopicEnv(module.namespace, key, topic);
          return acc;
        },
        {} as Record<string, string>,
      );

      const { createSNSClient } = await import("@core/helpers/sns");
      return createSNSClient({ ...snsEnv, topics: topicsArns });
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
} as const satisfies Record<
  string,
  Record<string, (module: BaseModule, key: string, ...args: any[]) => any>
>;

export type FeatureConfig = typeof featureConfig;
export type Feature = keyof FeatureConfig & {};
export type FeatureDriver<F extends Feature> = keyof FeatureConfig[F];
export type FeatureDriverMap<F extends Feature> = Record<F, FeatureDriver<F>>;

export type FeatureDriverType<
  F extends Feature = Feature,
  D extends FeatureDriver<F> = FeatureDriver<F>,
  // @ts-expect-error
> = Awaited<ReturnType<FeatureConfig[F][D]>>;

export function createDriver<
  F extends Feature,
  D extends FeatureDriver<F>,
  // @ts-expect-error
  P extends Parameters<FeatureConfig[F][D]>,
>(feature: F, driver: D, ...args: P): Promise<FeatureDriverType<F, D>> {
  // @ts-expect-error
  return featureConfig[feature][driver](...args);
}
