import type { BaseApp } from "@core/gn-app";
import type { BaseModule } from "@core/gn-module";
import type { createHttpClient } from "@core/helpers/http";
import type { createMysqlClient } from "@core/helpers/mysql";
import type { createPostgresClient } from "@core/helpers/postgres";
import type { Redis } from "@core/helpers/redis";
import type { createS3Client } from "@core/helpers/s3";
import type { createSNSClient } from "@core/helpers/sns";
import type { Prettify } from "@core/helpers/types";

type ModuleOrApp = BaseModule | BaseApp;

const features = {
  "db.postgres": async ({
    module,
    alias = "default",
  }: {
    module: ModuleOrApp;
    alias?: string;
  }) => {
    const postgres = await import("@core/helpers/postgres");
    const dbEnv = postgres.getPostgresEnv(
      "namespace" in module ? module.namespace : undefined,
      alias,
    );
    return postgres.createPostgresClient({ connectionString: dbEnv.url });
  },

  "db.mysql": async ({
    module,
    alias = "default",
  }: {
    module: ModuleOrApp;
    alias?: string;
  }) => {
    const mysql = await import("@core/helpers/mysql");
    const dbEnv = mysql.getMysqlEnv(
      "namespace" in module ? module.namespace : undefined,
      alias,
    );
    return mysql.createMysqlClient({ uri: dbEnv.url });
  },

  "cache.redis": async ({
    module,
    alias = "default",
  }: {
    module: ModuleOrApp;
    alias?: string;
  }) => {
    const redis = await import("@core/helpers/redis");
    const redisEnv = redis.getRedisEnv(
      "namespace" in module ? module.namespace : undefined,
      alias,
    );
    return redis.createRedisClient(redisEnv);
  },

  "storage.s3": async ({
    module,
    alias = "default",
  }: {
    module: ModuleOrApp;
    alias?: string;
  }) => {
    const s3 = await import("@core/helpers/s3");
    const s3Env = s3.getS3Env(
      "namespace" in module ? module.namespace : undefined,
      alias,
    );
    return s3.createS3Client(s3Env);
  },

  "notification.sns": async <const Topics extends ReadonlyArray<string>>({
    module,
    alias = "default",
    topics,
  }: {
    module: ModuleOrApp;
    alias?: string;
    topics: Topics;
  }) => {
    const sns = await import("@core/helpers/sns");
    const snsEnv = sns.getSNSEnv(
      "namespace" in module ? module.namespace : undefined,
      alias,
      topics,
    );
    return sns.createSNSClient(snsEnv);
  },

  "http.webservice": async ({
    module,
    alias = "default",
  }: {
    module: ModuleOrApp;
    alias?: string;
  }) => {
    const http = await import("@core/helpers/http");
    const httpEnv = http.getHttpEnv(
      "namespace" in module ? module.namespace : undefined,
      alias,
    );

    return http.createHttpClient(httpEnv);
  },
} as const;

export type FeaturesType = typeof features;
export type Feature = keyof FeaturesType;
export type FeatureType = Feature extends `${infer A}.${string}` ? A : never;
export type FeatureReturn<F extends Feature> = Awaited<
  ReturnType<FeaturesType[F]>
>;

type FeatureParams<F extends Feature, K = FeaturesType[F]> = K extends (
  arg: infer P,
) => unknown
  ? keyof P extends "module" | "alias"
    ? { config?: never }
    : { config: Prettify<Omit<P, "module" | "alias">> }
  : { config?: never };

// Discriminated union for feature configs
export type FeatureConfig =
  | ({ type: "db.postgres" } & FeatureParams<"db.postgres">)
  | ({ type: "db.mysql" } & FeatureParams<"db.mysql">)
  | ({ type: "cache.redis" } & FeatureParams<"cache.redis">)
  | ({ type: "storage.s3" } & FeatureParams<"storage.s3">)
  | ({ type: "notification.sns" } & FeatureParams<"notification.sns">)
  | ({ type: "http.webservice" } & FeatureParams<"http.webservice">);

export type FeatureConfigReturn<T extends FeatureConfig> = T extends {
  type: "db.postgres";
}
  ? ReturnType<typeof createPostgresClient>
  : T extends { type: "db.mysql" }
    ? ReturnType<typeof createMysqlClient>
    : T extends { type: "cache.redis" }
      ? Redis
      : T extends { type: "storage.s3" }
        ? ReturnType<typeof createS3Client>
        : T extends {
              type: "notification.sns";
              config: {
                topics: infer Topics extends ReadonlyArray<string>;
              };
            }
          ? ReturnType<typeof createSNSClient<Topics>>
          : T extends { type: "http.webservice" }
            ? ReturnType<typeof createHttpClient>
            : never;

export type FeatureImAlive =
  | { type: "db.postgres"; driver: FeatureReturn<"db.postgres"> }
  | { type: "db.mysql"; driver: FeatureReturn<"db.mysql"> }
  | { type: "cache.redis"; driver: FeatureReturn<"cache.redis"> }
  | { type: "storage.s3"; driver: FeatureReturn<"storage.s3"> }
  | { type: "notification.sns"; driver: FeatureReturn<"notification.sns"> }
  | { type: "http.webservice"; driver: FeatureReturn<"http.webservice"> };

export function createFeature<F extends Feature>(
  feature: F,
  config: FeatureParams<F>,
  module: ModuleOrApp,
  alias = "default",
): FeatureReturn<F> {
  // @ts-expect-error
  return features[feature]({ module, alias, ...config });
}
