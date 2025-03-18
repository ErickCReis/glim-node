import { coreEnv } from "@core/helpers/env";
import { getConnInfo } from "@hono/node-server/conninfo";
import type { Context } from "hono";

export function errorHandler(c: Context) {
  const err = c.error;
  if (!err) {
    return c.res;
  }

  const logger = c.var.logger;
  logger.error(err);

  const data = {
    status: 500,
    message: err.message || "Internal server error",
    extras: undefined as unknown as Record<string, unknown>,
  };

  if ("status" in err) {
    data.status = Number(err.status);
  }

  if (coreEnv.APP_ENV === "DEV") {
    const stack = err.stack?.split("\n").map((l) => l.trim());

    const path = new URL(c.req.url).pathname;
    const info = getConnInfo(c);
    const host = c.req.header("host") ?? "";
    const remoteAddress = info.remote.address ?? "";
    const remotePort = info.remote.port ?? 0;

    data.extras = {
      status: data.status,
      message: stack?.shift(),

      method: c.req.method,
      url: path,
      host,
      remoteAddress,
      remotePort,

      "stack-trace": stack,
    };
  }

  return new Response(JSON.stringify(data), {
    status: data.status,
    headers: {
      "content-type": "application/json",
    },
  });
}
