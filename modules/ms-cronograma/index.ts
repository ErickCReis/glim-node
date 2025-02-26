import { createModule } from "@core/gn-module.js";
import { router } from "./router.js";

export const mscronograma = createModule("ms-cronograma", {
  db: "postgres",
});

const mscronogramaRouter = mscronograma.loadRouter((basePath) =>
  router.basePath(basePath)
);

export type Client = NonNullable<typeof mscronogramaRouter>;
