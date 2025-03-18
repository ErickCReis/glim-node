import type { Logger } from "@core/helpers/logger";
import { getConnInfo } from "@hono/node-server/conninfo";
import { createMiddleware } from "hono/factory";

type Context = {
  Variables: {
    logger: Logger;
  };
};

declare module "hono" {
  interface ContextVariableMap {
    logger: Logger;
  }
}

export function loggerMiddleware(obj: { logger: Logger }) {
  return createMiddleware<Context>(async (c, next) => {
    obj.logger = obj.logger.child({ "trace-id": c.var.requestId });
    c.set("logger", obj.logger);

    const start = Date.now();

    const { method, url } = c.req;
    const path = new URL(url).pathname;

    const info = getConnInfo(c);
    const host = c.req.header("host") ?? "";
    const remoteAddress = info.remote.address ?? "";
    const remotePort = info.remote.port ?? 0;

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

    if (!c.error) {
      obj.logger.info(
        {
          res: {
            statusCode: c.res.status,
          },
          responseTime,
        },
        "request completed",
      );
    }
  });
}
