import fs from "node:fs";
import { join } from "node:path";
import type {
  Feature,
  FeatureImAlive,
  FeatureType,
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
  features: { [key: string]: FeatureImAlive },
) {
  return async (resource: FeatureType | "all" = "all", force = false) => {
    const logFileName = `im-alive${resource !== "all" ? `.${resource}` : ""}.log`;
    const logPath = join(process.cwd(), logFileName);

    if (!force && fs.existsSync(logPath)) {
      fs.appendFileSync(logPath, `${Date.now()}\n`);
      return ["OK"] as const;
    }

    const checksPromises = [];

    for (const [key, value] of Object.entries(features)) {
      if (
        (resource === "all" || resource === "db") &&
        value.type === "db.postgres"
      ) {
        const alias = key.toLocaleLowerCase().replaceAll(/db[-_]?/g, "");
        const newKey = alias === "" ? "" : `.${alias}`;
        checksPromises.push(
          check(`db.${namespace}${newKey}`, () =>
            value.driver.execute("SELECT 1").then((r) => r.rowCount === 1),
          ),
        );
      }

      if (
        (resource === "all" || resource === "cache") &&
        value.type === "cache.redis"
      ) {
        const alias = key.toLocaleLowerCase().replaceAll(/cache[-_]?/g, "");
        const newKey = alias === "" ? "" : `.${alias}`;

        checksPromises.push(
          check(`cache.${namespace}${newKey}`, () =>
            value.driver.ping().then((r) => r === "PONG"),
          ),
        );
      }

      if (
        (resource === "all" || resource === "storage") &&
        value.type === "storage.s3"
      ) {
        const alias = key.toLocaleLowerCase().replaceAll(/storage[-_]?/g, "");
        const newKey = alias === "" ? "" : `.${alias}`;

        checksPromises.push(
          check(`storage.${namespace}${newKey}`, () =>
            value.driver.listBuckets().then(() => true),
          ),
        );
      }

      if (
        (resource === "all" || resource === "notification") &&
        value.type === "notification.sns"
      ) {
        const alias = key
          .toLocaleLowerCase()
          .replaceAll(/notification[-_]?/g, "");
        const newKey = alias === "" ? "" : `.${alias}`;

        checksPromises.push(
          check(`notification.${namespace}${newKey}`, () =>
            value.driver.listTopics().then((r) => (r.Topics?.length ?? 0) > 0),
          ),
        );
      }

      if (
        (resource === "all" || resource === "http") &&
        (value.type === "http.webservice" || value.type === "http.bifrost")
      ) {
        const alias = key.toLocaleLowerCase().replaceAll(/http[-_]?/g, "");
        const newKey = alias === "" ? "" : `.${alias}`;

        checksPromises.push(
          check(`http.${namespace}${newKey}`, () =>
            value.driver.get({ path: "/" }).then((r) => r.status === 200),
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
