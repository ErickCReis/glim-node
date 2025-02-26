import { type NodePgDatabase, drizzle } from "drizzle-orm/node-postgres";
import type { MiddlewareHandler } from "hono";
import pg from "pg";
import type { z } from "zod";
import type { GnRouter } from "./gn-router.js";

export function createModule<
  TNamespace extends string,
  TDB extends
    | {
        default: "postgres";
      }
    | undefined = undefined,
>(
  namespace: TNamespace,
  config: {
    db?: TDB;
  },
) {
  return <TEnv extends z.Schema = z.ZodNever>({
    env,
    router,
    middleware,
  }: {
    env: TEnv;
    router: GnRouter<TNamespace>;
    middleware: Array<MiddlewareHandler>;
  }): TDB extends undefined
    ? {
        namespace: TNamespace;
        env: z.infer<TEnv>;
        router: GnRouter<TNamespace>;
        middleware: Array<MiddlewareHandler>;
      }
    : {
        namespace: TNamespace;
        env: z.infer<TEnv>;
        db: NodePgDatabase;
        router: GnRouter<TNamespace>;
        middleware: Array<MiddlewareHandler>;
      } => {
    const envParsed = env.parse(process.env) as z.infer<TEnv>;

    const dbConfig = config.db;
    if (dbConfig) {
      const pool = new pg.Pool({
        connectionString: envParsed.DB_MS_CRONOGRAMA,
      });

      return {
        namespace,
        env: envParsed,
        db: drizzle(pool),
        router,
        middleware,
      };
    }

    return {
      namespace,
      env: envParsed,
      router,
      middleware,
    };
  };
}

export type GnModule<TNamespace extends string = string> = ReturnType<
  ReturnType<typeof createModule<TNamespace>>
>;
