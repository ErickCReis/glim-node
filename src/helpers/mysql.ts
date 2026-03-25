import { formatEnvKey } from "@core/helpers/utils";
import { drizzle } from "drizzle-orm/mysql2";
import type { MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { z } from "zod";

export type MysqlClient = MySql2Database<Record<string, never>> & {
  $client: mysql.Pool;
};

export type MysqlEnv = {
  host: string;
  database: string;
  username: string;
  password: string;
  url: string;
};

export function createMysqlClient(config: mysql.PoolOptions): MysqlClient {
  return drizzle(mysql.createPool(config));
}

export function getMysqlEnv(namespace?: string, alias = "default"): MysqlEnv {
  const key = formatEnvKey("DB", namespace, alias);
  const dbEnv = z
    .object({
      [`${key}_HOST`]: z.string(),
      [`${key}_DATABASE`]: z.string(),
      [`${key}_USERNAME`]: z.string(),
      [`${key}_PASSWORD`]: z.string(),
    })
    .parse(process.env);

  const host = dbEnv[`${key}_HOST`] as string;
  const database = dbEnv[`${key}_DATABASE`] as string;
  const username = dbEnv[`${key}_USERNAME`] as string;
  const password = dbEnv[`${key}_PASSWORD`] as string;
  const url = `mysql://${username}:${password}@${host}/${database}`;

  return { host, database, username, password, url };
}
