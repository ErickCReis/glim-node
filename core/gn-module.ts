import { type NodePgDatabase, drizzle } from "drizzle-orm/node-postgres";
import { Hono } from "hono";
import pg from "pg";
import { z } from "zod";

export function createModule<
  TNamespace extends string,
  TEnv extends z.Schema = z.ZodNever,
  TDB extends "postgres" | undefined = undefined
>(
  namespace: TNamespace,
  config: {
    env?: TEnv;
    db?: TDB;
  }
) {
  const envConfig = config.env;
  let env: z.infer<TEnv> | undefined = undefined;
  if (envConfig) {
    env = envConfig.parse(process.env);
  }

  const dbConfig = config.db;
  let db: NodePgDatabase | undefined = undefined;
  if (dbConfig) {
    const envDBSchema = z.object({ DB_MS_CRONOGRAMA: z.string() });
    const envDB = envDBSchema.parse(process.env);
    const pool = new pg.Pool({ connectionString: envDB.DB_MS_CRONOGRAMA });
    db = drizzle(pool);
  }

  return {
    namespace,
    env,
    db,
    _router: null,
    loadRouter<TRouter extends Hono>(
      router: (basePath: TNamespace) => TRouter
    ): TRouter {
      const r = router(namespace);

      // @ts-expect-error
      this._router = r;

      return r;
    },
  };
}

export type GnModule<TNamespace extends string = string> = ReturnType<
  typeof createModule<TNamespace>
>;
