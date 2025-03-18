import { errorHandler } from "@core/exceptions/error-handler";
import { createMiddleware } from "hono/factory";

export function errorMiddleware() {
  return createMiddleware(async (c, next) => {
    await next();

    if (c.error) {
      c.res = undefined;
      c.res = errorHandler(c);
    }
  });
}
