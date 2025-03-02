import { createLogger } from "@core/utils/logger.js";
import { drizzle } from "drizzle-orm/node-postgres";
import { Hono } from "hono";
import { hc } from "hono/client";
import pg from "pg";
import { z } from "zod";

const envOptions = ["local", "development", "staging", "production"] as const;
const envOptionsMap = {
  production: "PRD",
  staging: "STG",
  development: "DEV",
  local: "DEV",
} as const satisfies Record<(typeof envOptions)[number], string>;

export const appEnv = z
  .object({
    APP_NAME: z.string(),
    APP_ENV: z
      .enum(["local", "development", "staging", "production"])
      .transform((v) => envOptionsMap[v]),
  })
  .parse(process.env);

export async function createModule<
  TNamespace extends string,
  TEnv extends z.ZodType<object> = z.ZodType<object>,
>(
  namespace: TNamespace,
  config: {
    env?: TEnv;
    db: "postgres";
  } = {
    db: "postgres",
  },
) {
  const envConfig = config.env;
  let env: z.infer<TEnv> = {};
  if (envConfig) {
    env = envConfig.parse(process.env);
  }

  const db = await createPostgresConnection(namespace);

  return {
    namespace,
    env: {
      ...appEnv,
      ...env,
    },
    db,
    logger: createLogger(namespace),
    _router: null as unknown as Hono,
    loadRouter<TRouter extends Hono>(router: TRouter) {
      this._router = new Hono().basePath(namespace).route("", router);
      return hc<TRouter>(`http://localhost:3000/${namespace}`);
    },
  };
}

export type GnModule<TNamespace extends string = string> = Awaited<
  ReturnType<typeof createModule<TNamespace>>
>;

// HELPERS

async function createPostgresConnection(namespace: string) {
  const upperNamespace = namespace.replaceAll("-", "_").toUpperCase();
  const dbEnvSchema = z.object({
    [`DB_${upperNamespace}_HOST`]: z.string(),
    [`DB_${upperNamespace}_DATABASE`]: z.string(),
    [`DB_${upperNamespace}_USERNAME`]: z.string(),
    [`DB_${upperNamespace}_PASSWORD`]: z.string(),
  });

  const dbEnv = dbEnvSchema.parse(process.env);
  const connectionString = `postgresql://${dbEnv[`DB_${upperNamespace}_USERNAME`]}:${dbEnv[`DB_${upperNamespace}_PASSWORD`]}@${dbEnv[`DB_${upperNamespace}_HOST`]}/${dbEnv[`DB_${upperNamespace}_DATABASE`]}`;

  return drizzle(new pg.Pool({ connectionString }));
}
