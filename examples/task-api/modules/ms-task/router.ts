import { sValidator } from "@hono/standard-validator";
import { client, mstask } from "@ms-task";
import {
  createTaskUseCase,
  deleteTaskUseCase,
  getTaskUseCase,
  getTasksUseCase,
} from "@ms-task/use-cases/tasks";
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
  .get("/tasks", cacheMiddlewareByUser(), async (c) => {
    const tasks = await getTasksUseCase();
    return c.json(tasks);
  })
  .post(
    "/tasks",
    sValidator("json", z.object({ nome: z.string() })),
    async (c) => {
      const { nome } = c.req.valid("json");
      const task = await createTaskUseCase({ nome });
      if (!task) {
        throw new HTTPException(400);
      }

      mstask.invalidateCacheMiddleware(client.private.tasks.$url());
      mstask.invalidateCacheMiddlewareByUser(
        client.v1.tasks.$url(),
        client.v1.tasks[":id"].$url({ param: { id: "*" } }),
      );

      mstask.notification.publish("criacao-task", JSON.stringify(task));

      return c.json(task, 201);
    },
  )
  .get(
    "/tasks/:id",
    sValidator("param", z.object({ id: z.coerce.number() })),
    async (c) => {
      const { id } = c.req.valid("param");
      const task = await getTaskUseCase(id);
      if (!task) {
        throw new HTTPException(404);
      }

      mstask.httpMsStatistic.post({ path: "/task", body: { id: task.id } });

      return c.json(task);
    },
  )
  .delete(
    "/tasks/:id",
    sValidator("param", z.object({ id: z.coerce.number() })),
    async (c) => {
      const { id } = c.req.valid("param");
      await deleteTaskUseCase(id);
      return c.body(null, 204);
    },
  );

const routerPrivate = new Hono()
  .basePath("/private")
  .use(bifrostMiddleware)
  .get("/tasks", cacheMiddleware(), async (c) => {
    const tasks = await getTasksUseCase();
    return c.json(tasks);
  })
  .get("/error", async () => {
    throw new HTTPException(400, { message: "Teste" });
  });

export const router = new Hono().route("/", routerV1).route("/", routerPrivate);
