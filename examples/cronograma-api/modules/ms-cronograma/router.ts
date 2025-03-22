import { sValidator } from "@hono/standard-validator";
import { client, mscronograma } from "@ms-cronograma";
import {
  createCronogramaUseCase,
  deleteCronogramaUseCase,
  getCronogramaUseCase,
  getCronogramasUseCase,
} from "@ms-cronograma/use-cases/cronogramas";
import {
  authMiddleware,
  bifrostMiddleware,
  cacheMiddleware,
  cacheMiddlewareByUser,
} from "glim-node/middleware";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

const routerV1 = new Hono()
  .basePath("/v1")
  .use(authMiddleware)
  .get("/cronogramas", cacheMiddlewareByUser(), async (c) => {
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
        throw new HTTPException(400);
      }

      mscronograma.invalidateCacheMiddleware(client.private.cronogramas.$url());
      mscronograma.invalidateCacheMiddlewareByUser(
        client.v1.cronogramas.$url(),
        client.v1.cronogramas[":id"].$url({ param: { id: "*" } }),
      );

      return c.json(cronograma, 201);
    },
  )
  .get(
    "/cronogramas/:id",
    sValidator("param", z.object({ id: z.coerce.number() })),
    async (c) => {
      const { id } = c.req.valid("param");
      const cronograma = await getCronogramaUseCase(id);
      if (!cronograma) {
        throw new HTTPException(404);
      }

      mscronograma.httpMsAgendaBifrost.get({ path: "1" });

      return c.json(cronograma);
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
  .get("/cronogramas", cacheMiddleware(), async (c) => {
    const cronogramas = await getCronogramasUseCase();
    return c.json(cronogramas);
  })
  .get("/error", async () => {
    throw new HTTPException(400, { message: "Teste" });
  });

export const router = new Hono().route("/", routerV1).route("/", routerPrivate);
