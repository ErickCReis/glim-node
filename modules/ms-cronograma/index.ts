import { createModule } from "@core/gn-module.js";
import { router } from "./router.js";

export const mscronograma = await createModule("ms-cronograma", {
  db: "postgres",
});

export const client = mscronograma.loadRouter(router);

// Client test
// client.cronogramas
//   .$get(undefined, {
//     headers: { "x-auth": btoa(JSON.stringify({})) },
//   })
//   .then((r) => r.json())
//   .then((r) => console.log(r));
