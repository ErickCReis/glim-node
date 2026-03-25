import { mock } from "bun:test";

export function createNodeServerEnv() {
  return {
    incoming: {
      socket: {
        remoteAddress: "127.0.0.1",
        remotePort: 3000,
        remoteFamily: "IPv4",
      },
    },
  };
}

export function createLoggerMock() {
  const logger = {
    child: mock(() => logger),
    info: mock(() => undefined),
    error: mock(() => undefined),
  };

  return logger;
}

export function createCacheDriver(seed: Record<string, Record<string, string>> = {}) {
  const store = new Map<string, Map<string, string>>();

  for (const [key, value] of Object.entries(seed)) {
    store.set(key, new Map(Object.entries(value)));
  }

  return {
    store,
    driver: {
      async inDb<T>(_db: number, fn: () => Promise<T>) {
        return fn();
      },
      async hget(key: string, field: string) {
        return store.get(key)?.get(field) ?? null;
      },
      async hset(key: string, field: string, value: string) {
        const bucket = store.get(key) ?? new Map<string, string>();
        bucket.set(field, value);
        store.set(key, bucket);
      },
      async hdel(key: string, ...fields: string[]) {
        const bucket = store.get(key);
        if (!bucket) return 0;

        for (const field of fields) {
          bucket.delete(field);
        }

        return fields.length;
      },
      async hkeys(key: string) {
        return [...(store.get(key)?.keys() ?? [])];
      },
      async expiretime() {
        return -1;
      },
      async expire() {
        return 1;
      },
      async expireat() {
        return 1;
      },
    },
  };
}
