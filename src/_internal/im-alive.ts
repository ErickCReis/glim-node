import fs from "node:fs";
import { join } from "node:path";
import type { Feature, FeatureConfig } from "@core/_internal/features";

export type ImAlive = {
  status: "alive" | "dead";
  latency: number;
};

export type ImAliveFn = (
  resource: Feature | "all",
  force: boolean,
) => Promise<Record<string, ImAlive> | ["OK"]>;

async function check(key: string, fn: () => Promise<boolean> | boolean) {
  const startTime = process.hrtime();
  const success = await fn();
  const [elapsedTimeSec, elapsedTimeNano] = process.hrtime(startTime);
  const elapsed = (elapsedTimeSec * 1e9 + elapsedTimeNano / 1e9).toPrecision(6);
  return {
    [key]: {
      status: success ? ("alive" as const) : ("dead" as const),
      latency: elapsed,
    },
  };
}

export async function createImAlive(
  namespace: string,
  resources: {
    [K in keyof FeatureConfig]?: Partial<FeatureConfig[K]>;
  },
) {
  return async (resource: Feature | "all" = "all", force = false) => {
    const logFileName = `im-alive${resource !== "all" ? `.${resource}` : ""}.log`;
    const logPath = join(process.cwd(), logFileName);

    if (!force && fs.existsSync(logPath)) {
      fs.appendFileSync(logPath, `${Date.now()}\n`);
      return ["OK"] as const;
    }

    const checksPromises = [];

    const db = resources.db?.postgres;
    if ((resource === "all" || resource === "db") && db) {
      checksPromises.push(
        check(`db.${namespace}`, () =>
          db
            .execute("SELECT 1")
            .then((r) => r.rowCount === 1)
            .catch(() => false),
        ),
      );
    }

    const cache = resources.cache?.redis;
    if ((resource === "all" || resource === "cache") && cache) {
      checksPromises.push(
        check(`cache.${namespace}`, () =>
          cache.ping().then((r) => r === "PONG"),
        ),
      );
    }

    const storage = resources.storage?.s3;
    if ((resource === "all" || resource === "storage") && storage) {
      for (const [key, value] of Object.entries(storage)) {
        checksPromises.push(
          check(`storage.${namespace}.${key}`, () =>
            value
              .listBuckets()
              .then(() => true)
              .catch(() => false),
          ),
        );
      }
    }

    const results = await Promise.all(checksPromises);
    const res: Record<string, ImAlive> = {};
    for (const r of results) Object.assign(res, r);

    const allAlive = Object.values(res).every((r) => r.status === "alive");

    if (allAlive) {
      fs.appendFileSync(logPath, `${Date.now()}\n`);
    }

    return res;
  };
}
