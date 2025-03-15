import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

const AUTH_HEADER = "x-auth";

export type Auth = {
  id: number;
  name: string;
  nickname: string;
  sigue_aluno_id: number;
  sigue_professor_id: number;
  sigue_usuario_id: number;
  questoes_usuario_id: number;
};

export const authMiddleware = createMiddleware<{
  Variables: { auth: Auth };
}>(async (c, next) => {
  const authHeader = c.req.header(AUTH_HEADER);
  if (!authHeader) {
    throw new HTTPException(401, { message: "Usuário não autenticado." });
  }

  c.set("auth", JSON.parse(atob(authHeader)));
  await next();
});
