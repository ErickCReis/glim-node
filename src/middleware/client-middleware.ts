import type { MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

const CLIENT_HEADER = "x-client";

type Client = {
  id: number;
  key: string;
  version: string;
};

type ClientContext = {
  Variables: { client: Client };
};

export const clientMiddleware: MiddlewareHandler<ClientContext> = createMiddleware<ClientContext>(
  async (c, next) => {
    const clientHeader = c.req.header(CLIENT_HEADER);
    if (!clientHeader) {
      throw new HTTPException(400, { message: "Client não informado." });
    }

    c.set("client", JSON.parse(atob(clientHeader)));
    await next();
  },
);
