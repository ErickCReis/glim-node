import { Redis as IORedis, type RedisOptions } from "ioredis";

class Redis extends IORedis {
  async inDb<TResult>(
    db: number,
    callback: (...args: any[]) => Promise<TResult>,
  ) {
    await this.select(db <= 0 ? 0 : (db % 15) + 1);
    const result = await callback();
    await this.select(0);
    return result;
  }
}

export type { Redis };

export function createRedisClient(options: RedisOptions) {
  return new Redis(options);
}
