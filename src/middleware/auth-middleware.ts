import type { MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

const AUTH_HEADER = "x-auth";

export type Auth = {
  id: number;
  name: string;
  nickname: string;
};

type AuthContext = {
  Variables: { auth: Auth };
};

export const authMiddleware: MiddlewareHandler<AuthContext> = createMiddleware<AuthContext>(
  async (c, next) => {
    const authHeader = c.req.header(AUTH_HEADER);
    if (!authHeader) {
      throw new HTTPException(401, { message: "Usuário não autenticado." });
    }

    c.set("auth", JSON.parse(atob(authHeader)));
    await next();
  },
);
