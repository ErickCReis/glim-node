import fs from "node:fs";
import { join } from "node:path";
import type {
  Feature,
  FeatureConfig,
  FeatureDriverType,
} from "@core/_internal/features";

export type ImAlive = {
  status: "alive" | "dead";
  latency: number;
};

export type ImAliveFn = (
  resource: Feature | "all",
  force: boolean,
) => Promise<Record<string, ImAlive> | readonly ["OK"]>;

async function check(key: string, fn: () => Promise<boolean>) {
  const startTime = process.hrtime();
  const success = await fn().catch(() => false);
  const [elapsedTimeSec, elapsedTimeNano] = process.hrtime(startTime);
  const elapsed = (elapsedTimeSec * 1e9 + elapsedTimeNano / 1e9).toPrecision(6);
  return {
    [key]: {
      status: success ? ("alive" as const) : ("dead" as const),
      latency: elapsed,
    },
  };
}

export function createImAlive(
  namespace: string,
  resources: {
    [K in keyof FeatureConfig]?: Record<string, FeatureDriverType<K>>;
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

    if (resource === "all" || resource === "db") {
      for (const [key, value] of Object.entries(resources.db ?? {})) {
        const keyName = key.replace("db", "").toLocaleLowerCase();
        const newKey = keyName === "" ? "" : `.${keyName}`;

        checksPromises.push(
          check(`db.${namespace}${newKey}`, () =>
            value.execute("SELECT 1").then((r) => r.rowCount === 1),
          ),
        );
      }
    }

    if (resource === "all" || resource === "cache") {
      for (const [key, value] of Object.entries(resources.cache ?? {})) {
        const keyName = key.replace("cache", "").toLocaleLowerCase();
        const newKey = keyName === "" ? "" : `.${keyName}`;

        checksPromises.push(
          check(`cache.${namespace}${newKey}`, () =>
            value.ping().then((r) => r === "PONG"),
          ),
        );
      }
    }

    if (resource === "all" || resource === "storage") {
      for (const [key, value] of Object.entries(resources.storage ?? {})) {
        const keyName = key.replace("storage", "").toLocaleLowerCase();
        const newKey = keyName === "" ? "" : `.${keyName}`;

        checksPromises.push(
          check(`storage.${namespace}${newKey}`, () =>
            value.listBuckets().then(() => true),
          ),
        );
      }
    }

    if (resource === "all" || resource === "http") {
      for (const [key, value] of Object.entries(resources.http ?? {})) {
        const keyName = key.replace("http", "").toLocaleLowerCase();
        const newKey = keyName === "" ? "" : `.${keyName}`;

        checksPromises.push(
          check(`http.${namespace}${newKey}`, () =>
            value.get({ path: "/" }).then((r) => r.status === 200),
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
