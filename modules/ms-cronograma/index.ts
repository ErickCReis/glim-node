import { createModule } from "@core/index.js";
import { router } from "@ms-cronograma/router.js";

export const mscronograma = await createModule("ms-cronograma", {
  db: "postgres",
  cache: "redis",
  storage: ["construcao"],
});

export const client = mscronograma.loadRouter(router);

// Client test
// client.cronogramas
//   .$get(undefined, {
//     headers: { "x-auth": btoa(JSON.stringify({})) },
//   })
//   .then((r) => r.json())
//   .then((r) => console.log(r));
