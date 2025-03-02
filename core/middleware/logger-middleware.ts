import { createLogger } from "@core/utils/logger.js";
import { getConnInfo } from "@hono/node-server/conninfo";
import { createMiddleware } from "hono/factory";

export function loggerMiddleware(logger = createLogger()) {
  return createMiddleware(async (c, next) => {
    const start = Date.now();

    const { method, url } = c.req;
    const path = new URL(url).pathname;

    const info = getConnInfo(c);
    const host = c.req.header("host") ?? "";
    const remoteAddress = info.remote.address ?? "";
    const remotePort = info.remote.port ?? 0;

    void logger("INFO", {
      req: {
        method,
        url: path,
        host,
        remoteAddress,
        remotePort,
      },
      message: "incoming request",
    });

    await next();

    const responseTime = Date.now() - start;

    void logger("INFO", {
      res: {
        statusCode: c.res.status,
      },
      responseTime,
      message: "request completed",
    });
  });
}
