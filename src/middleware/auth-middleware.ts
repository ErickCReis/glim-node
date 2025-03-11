import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

const AUTH_HEADER = "x-auth";

type User = {
  id: number;
  name: string;
  nickname: string;
  email: string;
};

export const authMiddleware = createMiddleware<{
  Variables: { auth: User };
}>(async (c, next) => {
  const authHeader = c.req.header(AUTH_HEADER);
  if (!authHeader) {
    throw new HTTPException(401, { message: "Usuário não autenticado." });
  }

  c.set("auth", JSON.parse(atob(authHeader)));
  await next();
});
