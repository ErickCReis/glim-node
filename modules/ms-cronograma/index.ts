import { createModule } from "@core/gn-module.js";
import { router } from "./router.js";

export const mscronograma = createModule("ms-cronograma", {
  db: "postgres",
});

export const client = mscronograma.loadRouter(router);

console.log(client.cronogramas.$url);
