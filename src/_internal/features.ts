import { getPostgresEnv, getRedisEnv, getS3Env } from "@core/helpers";

const featureConfig = {
  db: {
    async postgres(namespace: string, key = "default") {
      const dbEnv = getPostgresEnv(namespace);
      const { default: pg } = await import("pg");
      const { drizzle } = await import("drizzle-orm/node-postgres");
      return drizzle(new pg.Pool({ connectionString: dbEnv.url }));
    },
  },
  cache: {
    async redis(namespace: string, key = "default") {
      const redisEnv = getRedisEnv(namespace);
      const { createRedisClient } = await import("@core/helpers/redis");
      return createRedisClient(redisEnv);
    },
  },
  storage: {
    async s3(namespace: string, key = "default") {
      const s3Env = getS3Env(namespace, key);
      const { createS3Client } = await import("@core/helpers/s3");
      return createS3Client(s3Env);
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

export function createDriver<
  F extends Feature,
  D extends FeatureDriver<F>,
  TNamespace extends string,
>(
  feature: F,
  driver: D,
  namespace: TNamespace,
  key = "default",
): Promise<FeatureDriverType<F, D>> {
  // @ts-expect-error
  return featureConfig[feature][driver](namespace, key);
}
