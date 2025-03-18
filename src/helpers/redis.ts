import { Redis as IORedis, type RedisOptions } from "ioredis";

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
