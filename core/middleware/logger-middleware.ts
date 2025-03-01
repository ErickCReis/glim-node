import { appEnv } from "@core/gn-module.js";
import { toISOStringWithTimezone } from "@core/utils/date.js";
import {
  type LogObjectReq,
  type LogObjectRes,
  saveLog,
} from "@core/utils/log.js";
import { getConnInfo } from "@hono/node-server/conninfo";
import { createMiddleware } from "hono/factory";

export const loggerMiddleware = createMiddleware(async (c, next) => {
  const start = Date.now();

  const { method, url } = c.req;
  const path = new URL(url).pathname;

  const info = getConnInfo(c);
  const traceId = c.get("requestId");
  const host = c.req.header("host") ?? "";
  const remoteAddress = info.remote.address ?? "";
  const remotePort = info.remote.port ?? 0;

  // Log incoming request
  const incomingLog: LogObjectReq = {
    severity: "INFO",
    timestamp: toISOStringWithTimezone(new Date()),
    "trace-id": traceId,
    appname: appEnv.APP_NAME,
    env: appEnv.APP_ENV,
    req: {
      method,
      url: path,
      host,
      remoteAddress,
      remotePort,
    },
    message: "incoming request",
  };

  void saveLog(incomingLog);

  await next();

  const responseTime = Date.now() - start;

  const completedLog: LogObjectRes = {
    severity: "INFO",
    timestamp: toISOStringWithTimezone(new Date()),
    "trace-id": traceId,
    appname: appEnv.APP_NAME,
    env: appEnv.APP_ENV,
    res: {
      statusCode: c.res.status,
    },
    responseTime,
    message: "request completed",
  };

  void saveLog(completedLog);
});
