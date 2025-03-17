import { toISOStringWithTimezone } from "@core/_internal/date";
import { coreEnv } from "@core/helpers/env";
import pino from "pino";

export type Logger = pino.Logger;

export function createLogger(namespace = "main"): Logger {
  return pino({
    level: coreEnv.APP_ENV === "DEV" ? "debug" : "info",
    timestamp: () => `,"timestamp":"${toISOStringWithTimezone(new Date())}"`,
    formatters: {
      bindings: () => ({
        appname: `${coreEnv.APP_NAME}/${namespace}`,
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
      options: { destination: `./logs/${namespace}.log`, mkdir: true },
    },
  });
}
