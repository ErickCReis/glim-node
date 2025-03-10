import type { Logger } from "@core/helpers/logger";
import { getConnInfo } from "@hono/node-server/conninfo";
import { createMiddleware } from "hono/factory";

export function loggerMiddleware(obj: { logger: Logger }) {
  return createMiddleware(async (c, next) => {
    const start = Date.now();

    const { method, url } = c.req;
    const path = new URL(url).pathname;

    const info = getConnInfo(c);
    const host = c.req.header("host") ?? "";
    const remoteAddress = info.remote.address ?? "";
    const remotePort = info.remote.port ?? 0;

    obj.logger = obj.logger.child({
      "trace-id": c.var.requestId,
    });

    obj.logger.info(
      {
        req: {
          method,
          url: path,
          host,
          remoteAddress,
          remotePort,
        },
      },
      "incoming request",
    );

    await next();

    const responseTime = Date.now() - start;

    obj.logger.info(
      {
        res: {
          statusCode: c.res.status,
        },
        responseTime,
      },
      "request completed",
    );
  });
}
