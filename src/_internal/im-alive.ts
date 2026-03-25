import fs from "node:fs";
import { join } from "node:path";
import type { Feature, FeatureImAlive, FeatureType } from "@core/_internal/features";
export type ImAlive = {
  status: "alive" | "dead";
  latency: number;
};

export type ImAliveFn = (
  resource: Feature | "all",
  force: boolean,
) => Promise<Record<string, ImAlive> | readonly ["OK"]>;

type ImAliveRuntime = {
  appendFileSync?: typeof fs.appendFileSync;
  existsSync?: typeof fs.existsSync;
  getCwd?: () => string;
  hrtime?: typeof process.hrtime;
  now?: () => number;
};

function resolveRuntime(runtime: ImAliveRuntime = {}) {
  return {
    appendFileSync: runtime.appendFileSync ?? fs.appendFileSync,
    existsSync: runtime.existsSync ?? fs.existsSync,
    getCwd: runtime.getCwd ?? (() => process.cwd()),
    hrtime: runtime.hrtime ?? process.hrtime,
    now: runtime.now ?? Date.now,
  };
}

async function check(
  key: string,
  fn: () => Promise<boolean>,
  runtime: ReturnType<typeof resolveRuntime>,
) {
  const startTime = runtime.hrtime();
  const success = await fn().catch(() => false);
  const [elapsedTimeSec, elapsedTimeNano] = runtime.hrtime(startTime);
  const elapsed = (elapsedTimeSec * 1e9 + elapsedTimeNano / 1e9).toPrecision(6);
  return {
    [key]: {
      status: success ? ("alive" as const) : ("dead" as const),
      latency: elapsed,
    },
  };
}

export function createImAlive(
  namespace: string | undefined,
  features: { [key: string]: FeatureImAlive },
  runtime: ImAliveRuntime = {},
) {
  const resolvedRuntime = resolveRuntime(runtime);
  return async (resource: FeatureType | "all" = "all", force = false) => {
    const logFileName = `im-alive${resource !== "all" ? `.${resource}` : ""}.log`;
    const logPath = join(resolvedRuntime.getCwd(), logFileName);

    if (!force && resolvedRuntime.existsSync(logPath)) {
      resolvedRuntime.appendFileSync(logPath, `${resolvedRuntime.now()}\n`);
      return ["OK"] as const;
    }

    const checksPromises = [];

    for (const [key, value] of Object.entries(features)) {
      if (
        (resource === "all" || resource === "db") &&
        (value.type === "db.postgres" || value.type === "db.mysql")
      ) {
        const alias = key.toLocaleLowerCase().replaceAll(/db[-_]?/g, "");
        const newKey = alias === "" ? "" : `.${alias}`;
        const resourceKey = namespace ? `db.${namespace}${newKey}` : `db${newKey}`;
        checksPromises.push(
          check(
            resourceKey,
            () =>
              value.driver
                // @ts-expect-error
                .execute("SELECT 1")
                // @ts-expect-error
                .then((r) => r.rowCount === 1),
            resolvedRuntime,
          ),
        );
      }

      if ((resource === "all" || resource === "cache") && value.type === "cache.redis") {
        const alias = key.toLocaleLowerCase().replaceAll(/cache[-_]?/g, "");
        const newKey = alias === "" ? "" : `.${alias}`;
        const resourceKey = namespace ? `cache.${namespace}${newKey}` : `cache${newKey}`;

        checksPromises.push(
          check(resourceKey, () => value.driver.ping().then((r) => r === "PONG"), resolvedRuntime),
        );
      }

      if ((resource === "all" || resource === "storage") && value.type === "storage.s3") {
        const alias = key.toLocaleLowerCase().replaceAll(/storage[-_]?/g, "");
        const newKey = alias === "" ? "" : `.${alias}`;
        const resourceKey = namespace ? `storage.${namespace}${newKey}` : `storage${newKey}`;

        checksPromises.push(
          check(resourceKey, () => value.driver.listBuckets().then(() => true), resolvedRuntime),
        );
      }

      if (
        (resource === "all" || resource === "notification") &&
        value.type === "notification.sns"
      ) {
        const alias = key.toLocaleLowerCase().replaceAll(/notification[-_]?/g, "");
        const newKey = alias === "" ? "" : `.${alias}`;
        const resourceKey = namespace
          ? `notification.${namespace}${newKey}`
          : `notification${newKey}`;

        checksPromises.push(
          check(
            resourceKey,
            () => value.driver.listTopics().then((r) => (r.Topics?.length ?? 0) > 0),
            resolvedRuntime,
          ),
        );
      }

      if ((resource === "all" || resource === "http") && value.type === "http.webservice") {
        const alias = key.toLocaleLowerCase().replaceAll(/http[-_]?/g, "");
        const newKey = alias === "" ? "" : `.${alias}`;
        const resourceKey = namespace ? `http.${namespace}${newKey}` : `http${newKey}`;

        checksPromises.push(
          check(
            resourceKey,
            () => value.driver.get({ path: "/" }).then((r) => r.status === 200),
            resolvedRuntime,
          ),
        );
      }
    }

    const results = await Promise.all(checksPromises);
    const res: Record<string, ImAlive> = {};
    for (const r of results) Object.assign(res, r);

    const allAlive = Object.values(res).every((r) => r.status === "alive");

    if (allAlive) {
      resolvedRuntime.appendFileSync(logPath, `${resolvedRuntime.now()}\n`);
    }

    return res;
  };
}
