import IORedis from "ioredis";

export class Redis extends IORedis {
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
