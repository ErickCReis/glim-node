import { sValidator } from "@hono/standard-validator";
import {
  createCronogramaUseCase,
  deleteCronogramaUseCase,
  getCronogramasUseCase,
} from "@ms-cronograma/use-cases/cronogramas";
import { authMiddleware, bifrostMiddleware } from "glim-node/middleware";
import { Hono } from "hono";
import { z } from "zod";

const routerV1 = new Hono()
  .basePath("/v1")
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
  );

const routerPrivate = new Hono()
  .basePath("/private")
  .use(bifrostMiddleware)
  .get("/cronogramas", async (c) => {
    const cronogramas = await getCronogramasUseCase();
    return c.json(cronogramas);
  })

export const router = new Hono()
  .route("/", routerV1)
  .route("/", routerPrivate);