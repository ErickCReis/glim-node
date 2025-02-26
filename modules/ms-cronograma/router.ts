import { createRouter } from "@core/gn-router.js";
import { auth } from "@core/helpers/auth.js";
import { authMiddleware } from "@core/middleware/auth-middleware.js";
import { Hono } from "hono";

export const router = createRouter("ms-cronograma")({
  v1: (basePath) =>
    new Hono()
      .basePath(basePath)
      .get("/", (c) => {
        return c.json({ teste: "cronograma", auth });
      })
      .use(authMiddleware)
      .get("/cronogramas", (c) => c.json([auth])),
});
