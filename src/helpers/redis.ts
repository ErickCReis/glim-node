import { formatEnvKey } from "@core/helpers/utils";
import { Redis as IORedis, type RedisOptions } from "ioredis";
import { z } from "zod";

class Redis extends IORedis {
  #runningInDb: Promise<any> | null = null;

  async inDb<TResult>(
    db: number,
    callback: (...args: any[]) => Promise<TResult>,
  ) {
    const operation = async () => {
      await this.select(db <= 0 ? 0 : (db % 15) + 1);
      try {
        const result = await callback();
        return result;
      } finally {
        await this.select(0); // Reset to default database
      }
    };

    // If there's an ongoing operation, wait for it to complete
    if (this.#runningInDb) {
      await this.#runningInDb;
    }

    // Set the current operation and execute it
    this.#runningInDb = operation();
    const result = await this.#runningInDb;

    // Clear the current operation reference
    this.#runningInDb = null;

    return result;
  }
}

export type { Redis };

export function createRedisClient(options: RedisOptions) {
  return new Redis(options);
}

export function getRedisEnv(namespace?: string, alias = "default") {
  const key = formatEnvKey("CACHE", namespace, alias);
  const redisEnv = z
    .object({
      [`${key}_HOST`]: z.string(),
      [`${key}_PORT`]: z.coerce.number(),
    })
    .parse(process.env);

  const host = redisEnv[`${key}_HOST`] as string;
  const port = redisEnv[`${key}_PORT`] as number | undefined;

  return { host, port };
}
