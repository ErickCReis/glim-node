import { mainEnv } from "@core/gn-module.js";
import { toISOStringWithTimezone } from "@core/utils/date.js";
import { appendFile } from "node:fs/promises";

type Severity = "TRACE" | "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";

export type Logger = (severity: Severity, extra: object) => Promise<void>;

export function createLogger(namespace = "main"): Logger {
  return async function logger(severity, extra) {
    await appendFile(
      `./logs/${namespace}.log`,
      `${JSON.stringify({
        severity,
        timestamp: toISOStringWithTimezone(new Date()),
        appname: `${mainEnv.APP_NAME}/${namespace}`,
        env: mainEnv.APP_ENV,
        ...extra,
      })}\n`,
    );
  };
}
