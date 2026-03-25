import type { BaseApp } from "@core/gn-app";
import type { BaseModule } from "@core/gn-module";
import type { HttpClient } from "@core/helpers/http";
import type { MysqlClient } from "@core/helpers/mysql";
import type { PostgresClient } from "@core/helpers/postgres";
import type { Redis } from "@core/helpers/redis";
import type { S3 } from "@core/helpers/s3";
import type { SNS } from "@core/helpers/sns";
import type { Prettify } from "@core/helpers/types";

type ModuleOrApp = BaseModule | BaseApp;
type EmptyConfig = Record<never, never>;

type FeatureConfigMap = {
  "db.postgres": EmptyConfig;
  "db.mysql": EmptyConfig;
  "cache.redis": EmptyConfig;
  "storage.s3": EmptyConfig;
  "notification.sns": {
    topics: ReadonlyArray<string>;
  };
  "http.webservice": EmptyConfig;
};

type FeatureReturnMap = {
  "db.postgres": PostgresClient;
  "db.mysql": MysqlClient;
  "cache.redis": Redis;
  "storage.s3": S3;
  "http.webservice": HttpClient;
};

type NotificationTopics<TConfig> = TConfig extends {
  topics: infer Topics extends ReadonlyArray<string>;
}
  ? Topics
  : ReadonlyArray<string>;

type FeatureConfigEntry<F extends Feature> = keyof FeatureConfigMap[F] extends never
  ? {
      type: F;
      config?: never;
    }
  : {
      type: F;
      config: Prettify<FeatureConfigMap[F]>;
    };

type FeatureConfigValueFor<F extends Feature, TConfig extends FeatureConfig> = TConfig extends {
  config: infer Config extends FeatureRuntimeConfig<F>;
}
  ? Config
  : FeatureRuntimeConfig<F>;

export type Feature = keyof FeatureConfigMap;
export type FeatureType = Feature extends `${infer A}.${string}` ? A : never;
export type FeatureRuntimeConfig<F extends Feature> = Prettify<FeatureConfigMap[F]>;
export type FeatureReturn<
  F extends Feature,
  Config extends FeatureRuntimeConfig<F> = FeatureRuntimeConfig<F>,
> = F extends keyof FeatureReturnMap
  ? FeatureReturnMap[F]
  : F extends "notification.sns"
    ? SNS<NotificationTopics<Config>>
    : never;

export type FeatureConfig = {
  [F in Feature]: FeatureConfigEntry<F>;
}[Feature];

export type ValidFeatureConfig<T> = Extract<T, FeatureConfig>;
export type FeatureConfigShape<
  TConfig extends Record<string, unknown>,
  TReservedKeys extends PropertyKey,
> = {
  [K in keyof TConfig]: K extends TReservedKeys
    ? never
    : TConfig[K] extends FeatureConfig
      ? TConfig[K]
      : never;
};
export type FeatureResultMap<TConfig extends Record<string, unknown>> = {
  [K in keyof TConfig]: FeatureConfigReturn<ValidFeatureConfig<TConfig[K]>>;
};
export type ResolvedFeatureConfigMap<TConfig extends Record<string, unknown>> = {
  [K in keyof TConfig]: ValidFeatureConfig<TConfig[K]>;
};

export type FeatureConfigReturn<T extends FeatureConfig> = T extends {
  type: infer F extends Feature;
}
  ? FeatureReturn<F, FeatureConfigValueFor<F, T>>
  : never;

export type FeatureImAlive = {
  [F in Feature]: {
    type: F;
    driver: FeatureReturn<F>;
  };
}[Feature];

export async function createFeature<
  const F extends Feature,
  const Config extends FeatureRuntimeConfig<F>,
>(
  feature: F,
  config: Config,
  module: ModuleOrApp,
  alias = "default",
): Promise<FeatureReturn<F, Config>> {
  const namespace = "namespace" in module ? module.namespace : undefined;

  switch (feature) {
    case "db.postgres": {
      const postgres = await import("@core/helpers/postgres");
      const dbEnv = postgres.getPostgresEnv(namespace, alias);
      return postgres.createPostgresClient({ connectionString: dbEnv.url }) as FeatureReturn<
        F,
        Config
      >;
    }
    case "db.mysql": {
      const mysql = await import("@core/helpers/mysql");
      const dbEnv = mysql.getMysqlEnv(namespace, alias);
      return mysql.createMysqlClient({ uri: dbEnv.url }) as FeatureReturn<F, Config>;
    }
    case "cache.redis": {
      const redis = await import("@core/helpers/redis");
      const redisEnv = redis.getRedisEnv(namespace, alias);
      return redis.createRedisClient(redisEnv) as FeatureReturn<F, Config>;
    }
    case "storage.s3": {
      const s3 = await import("@core/helpers/s3");
      const s3Env = s3.getS3Env(namespace, alias);
      return s3.createS3Client(s3Env) as FeatureReturn<F, Config>;
    }
    case "notification.sns": {
      const sns = await import("@core/helpers/sns");
      const snsConfig = config as unknown as FeatureRuntimeConfig<"notification.sns">;
      const snsEnv = sns.getSNSEnv(namespace, alias, snsConfig.topics);
      return sns.createSNSClient(snsEnv) as FeatureReturn<F, Config>;
    }
    case "http.webservice": {
      const http = await import("@core/helpers/http");
      const httpEnv = http.getHttpEnv(namespace, alias);
      return http.createHttpClient(httpEnv) as FeatureReturn<F, Config>;
    }
  }
}
