import type { BaseModule } from "@core/gn-module";
import type { Prettify } from "@core/helpers/types";

const features = {
  "db.postgres": async ({
    module,
    alias = "default",
  }: { module: BaseModule; alias?: string }) => {
    const postgres = await import("@core/helpers/postgres");
    const dbEnv = postgres.getPostgresEnv(module.namespace, alias);
    return postgres.createPostgresClient({ connectionString: dbEnv.url });
  },

  "cache.redis": async ({
    module,
    alias = "default",
  }: { module: BaseModule; alias?: string }) => {
    const redis = await import("@core/helpers/redis");
    const redisEnv = redis.getRedisEnv(module.namespace, alias);
    return redis.createRedisClient(redisEnv);
  },

  "storage.s3": async ({
    module,
    alias = "default",
  }: { module: BaseModule; alias?: string }) => {
    const s3 = await import("@core/helpers/s3");
    const s3Env = s3.getS3Env(module.namespace, alias);
    return s3.createS3Client(s3Env);
  },

  "notification.sns": async <Topics extends Array<string>>({
    module,
    alias = "default",
    topics,
  }: { module: BaseModule; alias?: string; topics: Topics }) => {
    const sns = await import("@core/helpers/sns");
    const snsEnv = sns.getSNSEnv(module.namespace, alias, topics);
    return sns.createSNSClient(snsEnv);
  },

  "http.webservice": async ({
    module,
    alias = "default",
  }: { module: BaseModule; alias?: string }) => {
    const http = await import("@core/helpers/http");
    const httpEnv = http.getHttpEnv(module.namespace, alias);

    return http.createHttpClient(httpEnv);
  },

  "http.bifrost": async ({
    module,
    alias = "default",
  }: { module: BaseModule; alias?: string }) => {
    const http = await import("@core/helpers/http");
    const httpEnv = http.getHttpEnv(module.namespace, alias);
    return http.createBifrostClient({
      ...httpEnv,
      getAuth: () => module["~context"]?.var.auth.id,
    });
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
) => any
  ? keyof P extends "module" | "alias"
    ? { config?: never }
    : { config: Prettify<Omit<P, "module" | "alias">> }
  : { config?: never };

// Discriminated union for feature configs
export type FeatureConfig =
  | ({ type: "db.postgres" } & FeatureParams<"db.postgres">)
  | ({ type: "cache.redis" } & FeatureParams<"cache.redis">)
  | ({ type: "storage.s3" } & FeatureParams<"storage.s3">)
  | ({ type: "notification.sns" } & FeatureParams<"notification.sns">)
  | ({ type: "http.webservice" } & FeatureParams<"http.webservice">)
  | ({ type: "http.bifrost" } & FeatureParams<"http.bifrost">);

export type FeatureImAlive =
  | { type: "db.postgres"; driver: FeatureReturn<"db.postgres"> }
  | { type: "cache.redis"; driver: FeatureReturn<"cache.redis"> }
  | { type: "storage.s3"; driver: FeatureReturn<"storage.s3"> }
  | { type: "notification.sns"; driver: FeatureReturn<"notification.sns"> }
  | { type: "http.webservice"; driver: FeatureReturn<"http.webservice"> }
  | { type: "http.bifrost"; driver: FeatureReturn<"http.bifrost"> };

export function createFeature<F extends Feature>(
  feature: F,
  config: FeatureParams<F>,
  module: BaseModule,
  alias = "default",
): FeatureReturn<F> {
  // @ts-expect-error
  return features[feature]({ module, alias, ...config });
}
