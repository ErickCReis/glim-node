import { coreEnv } from "@core/helpers/env.js";
import { toISOStringWithTimezone } from "@core/utils/date";
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
      options: { destination: `./logs/${namespace}.log` },
    },
  });
}
