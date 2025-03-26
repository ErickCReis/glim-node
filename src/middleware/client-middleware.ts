import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

const CLIENT_HEADER = "x-client";

type Client = {
  id: number;
  key: string;
  version: string;
};

export const clientMiddleware = createMiddleware<{
  Variables: { client: Client };
}>(async (c, next) => {
  const clientHeader = c.req.header(CLIENT_HEADER);
  if (!clientHeader) {
    throw new HTTPException(400, { message: "Client não informado." });
  }

  c.set("client", JSON.parse(atob(clientHeader)));
  await next();
});
