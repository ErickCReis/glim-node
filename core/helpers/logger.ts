import { appendFile } from "node:fs/promises";
import { coreEnv } from "@core/helpers/env.js";
import { toISOStringWithTimezone } from "@core/utils/date.js";

type Severity = "TRACE" | "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";

export type Logger = (severity: Severity, extra: object) => Promise<void>;

export function createLogger(namespace = "main"): Logger {
  return async function logger(severity, extra) {
    await appendFile(
      `./logs/${namespace}.log`,
      `${JSON.stringify({
        severity,
        timestamp: toISOStringWithTimezone(new Date()),
        appname: `${coreEnv.APP_NAME}/${namespace}`,
        env: coreEnv.APP_ENV,
        ...extra,
      })}\n`,
    );
  };
}
