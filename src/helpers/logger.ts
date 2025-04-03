import { toISOStringWithTimezone } from "@core/_internal/date";
import { coreEnv } from "@core/helpers/env";
import pino from "pino";

export type Logger = pino.Logger;

export function createLogger(namespace?: string): Logger {
  const appName = namespace
    ? `${coreEnv.APP_NAME}/${namespace}`
    : coreEnv.APP_NAME;
  const logFile = namespace ? `./logs/${namespace}.log` : "./logs/app.log";

  return pino({
    level: coreEnv.APP_ENV === "DEV" ? "debug" : "info",
    timestamp: () => `,"timestamp":"${toISOStringWithTimezone(new Date())}"`,
    formatters: {
      bindings: () => ({
        appname: appName,
        env: coreEnv.APP_ENV,
      }),
      level: (label, sererity) => ({
        severity: label.toUpperCase(),
        level: sererity,
      }),
    },
    messageKey: "message",
    nestedKey: "extras",

    transport: {
      target: "pino/file",
      options: { destination: logFile, mkdir: true },
    },
  });
}
