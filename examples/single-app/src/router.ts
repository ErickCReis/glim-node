import { sValidator } from "@hono/standard-validator";
import {
  authMiddleware,
  cacheMiddleware,
  cacheMiddlewareByUser,
} from "glim-node/middleware";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { createTask, deleteTask, getTask, getTasks } from "./services/tasks";

const routerV1 = new Hono()
  .basePath("/v1")
  .use(authMiddleware)
  .get("/tasks", cacheMiddlewareByUser(), async (c) => {
    const tasks = await getTasks();
    return c.json(tasks);
  })
  .post(
    "/tasks",
    sValidator("json", z.object({ nome: z.string() })),
    async (c) => {
      const { nome } = c.req.valid("json");
      const task = await createTask({ nome });
      if (!task) {
        throw new HTTPException(400);
      }

      return c.json(task, 201);
    },
  )
  .get(
    "/tasks/:id",
    sValidator("param", z.object({ id: z.coerce.number() })),
    async (c) => {
      const { id } = c.req.valid("param");
      const task = await getTask(id);
      if (!task) {
        throw new HTTPException(404);
      }

      return c.json(task);
    },
  )
  .delete(
    "/tasks/:id",
    sValidator("param", z.object({ id: z.coerce.number() })),
    async (c) => {
      const { id } = c.req.valid("param");
      await deleteTask(id);
      return c.body(null, 204);
    },
  );

const routerPrivate = new Hono()
  .basePath("/private")
  .get("/tasks", cacheMiddleware(), async (c) => {
    const tasks = await getTasks();
    return c.json(tasks);
  });

export const router = new Hono().route("/", routerV1).route("/", routerPrivate);
