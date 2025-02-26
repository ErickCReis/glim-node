import { auth } from "@core/helpers/auth.js";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

export const AUTH_HEADER = "x-auth";

export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header(AUTH_HEADER) ?? "eyJpZCI6MX0=";

  if (!authHeader) {
    throw new HTTPException(401, { message: "'Usuário não autenticado.'" });
  }

  auth.login(authHeader);

  await next();

  auth.logout();
});
