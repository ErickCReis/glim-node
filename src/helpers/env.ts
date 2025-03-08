import { z } from "zod";

const appEnvOptions = [
  "local",
  "development",
  "staging",
  "production",
] as const;
const appEnvOptionsMap = {
  production: "PRD",
  staging: "STG",
  development: "DEV",
  local: "DEV",
} as const satisfies Record<(typeof appEnvOptions)[number], string>;

export const coreEnv = z
  .object({
    APP_NAME: z.string(),
    APP_ENV: z
      .enum(["local", "development", "staging", "production"])
      .transform((v) => appEnvOptionsMap[v]),
    APP_CORS_ORIGIN: z.string().optional().default("*"),
  })
  .parse(process.env);

export function getPostgresEnv(namespace: string) {
  const upperNamespace = namespace.replaceAll("-", "_").toUpperCase();
  const dbEnv = z
    .object({
      [`DB_${upperNamespace}_HOST`]: z.string(),
      [`DB_${upperNamespace}_DATABASE`]: z.string(),
      [`DB_${upperNamespace}_USERNAME`]: z.string(),
      [`DB_${upperNamespace}_PASSWORD`]: z.string(),
    })
    .parse(process.env);

  const host = dbEnv[`DB_${upperNamespace}_HOST`] as string;
  const database = dbEnv[`DB_${upperNamespace}_DATABASE`] as string;
  const username = dbEnv[`DB_${upperNamespace}_USERNAME`] as string;
  const password = dbEnv[`DB_${upperNamespace}_PASSWORD`] as string;
  const url = `postgresql://${username}:${password}@${host}/${database}`;

  return { host, database, username, password, url };
}

export function getRedisEnv(namespace: string) {
  const upperNamespace = namespace.replaceAll("-", "_").toUpperCase();
  const redisEnv = z
    .object({
      [`CACHE_${upperNamespace}_HOST`]: z.string(),
      [`CACHE_${upperNamespace}_PORT`]: z.coerce.number(),
    })
    .parse(process.env);

  const host = redisEnv[`CACHE_${upperNamespace}_HOST`] as string;
  const port = redisEnv[`CACHE_${upperNamespace}_PORT`] as number | undefined;

  return { host, port };
}

export function getS3Env(namespace: string, storageName: string) {
  const upperNamespace = namespace.replaceAll("-", "_").toUpperCase();
  const name = `${upperNamespace}_${storageName.toUpperCase()}`;
  const s3Env = z
    .object({
      [`STORAGE_${name}_REGION`]: z.string(),
      [`STORAGE_${name}_BUCKET`]: z.string(),
      [`STORAGE_${name}_ENDPOINT`]: z.string().optional(),
      [`STORAGE_${name}_ACCESS_KEY`]: z.string(),
      [`STORAGE_${name}_SECRET_KEY`]: z.string(),
    })
    .parse(process.env);

  const region = s3Env[`STORAGE_${name}_REGION`] as string;
  const bucket = s3Env[`STORAGE_${name}_BUCKET`] as string;
  const endpoint = s3Env[`STORAGE_${name}_ENDPOINT`];
  const accessKeyId = s3Env[`STORAGE_${name}_ACCESS_KEY`] as string;
  const secretAccessKey = s3Env[`STORAGE_${name}_SECRET_KEY`] as string;

  return {
    region,
    bucket,
    endpoint,
    accessKeyId,
    secretAccessKey,
  };
}
