import {
  type createS3Client,
  getPostgresEnv,
  getRedisEnv,
  getS3Env,
} from "@core/helpers";
import type { drizzle } from "drizzle-orm/node-postgres";
import type Redis from "ioredis";

export type FeatureConfig = {
  db: {
    postgres: ReturnType<typeof drizzle>;
  };
  cache: {
    redis: Redis;
  };
  storage: {
    s3: Record<string, ReturnType<typeof createS3Client>>;
  };
};

export type Feature = keyof FeatureConfig;
export type FeatureDriver<F extends Feature> = keyof FeatureConfig[F];
export type FeatureDriverMap<F extends Feature> = Record<
  F,
  keyof FeatureConfig[F]
>;
export type FeatureDriverType<
  F extends Feature,
  D extends FeatureDriver<F>,
> = FeatureConfig[F][D];

export const createConnection = {
  async postgres(namespace: string) {
    const dbEnv = getPostgresEnv(namespace);
    const { default: pg } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    return drizzle(new pg.Pool({ connectionString: dbEnv.url }));
  },

  async redis(namespace: string) {
    const redisEnv = getRedisEnv(namespace);
    const { Redis } = await import("ioredis");
    return new Redis(redisEnv);
  },

  async s3(namespace: string, storageName: string) {
    const s3Env = getS3Env(namespace, storageName);
    const { createS3Client } = await import("@core/helpers/s3.js");
    return createS3Client(s3Env);
  },
};
