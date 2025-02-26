import { createRouter } from "@core/gn-router.js";
import { auth } from "@core/helpers/auth.js";
import { authMiddleware } from "@core/middleware/auth-middleware.js";
import { sValidator } from "@hono/standard-validator";
import {
  createCronogramaUseCase,
  deleteCronogramaUseCase,
  getCronogramasUseCase,
} from "@ms-cronograma/use-cases/cronogramas.js";
import { Hono } from "hono";
import { z } from "zod";

export const router = createRouter("ms-cronograma")({
  v1: (basePath) =>
    new Hono()
      .basePath(basePath)
      .get("/", (c) => {
        return c.json({ teste: "cronograma", auth });
      })
      .use(authMiddleware)
      .get("/cronogramas", async (c) => {
        const cronogramas = await getCronogramasUseCase();
        return c.json(cronogramas);
      })
      .post(
        "/cronogramas",
        sValidator("json", z.object({ nome: z.string() })),
        async (c) => {
          const { nome } = c.req.valid("json");
          const cronograma = await createCronogramaUseCase({ nome });
          if (!cronograma) {
            return c.json({ message: "Erro" }, 404);
          }

          return c.json(cronograma, 201);
        },
      )
      .delete(
        "/cronogramas/:id",
        sValidator("param", z.object({ id: z.coerce.number() })),
        async (c) => {
          const { id } = c.req.valid("param");
          await deleteCronogramaUseCase(id);
          return c.body(null, 204);
        },
      ),
});
