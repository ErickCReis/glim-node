import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

const BIFROST_HEADER = "x-bifrost";

export const bifrostMiddleware = createMiddleware(async (c, next) => {
  const bifrostHeader = c.req.header(BIFROST_HEADER);
  if (!bifrostHeader) {
    throw new HTTPException(400, { message: "Bifrost não conjurada." });
  }

  await next();
});
