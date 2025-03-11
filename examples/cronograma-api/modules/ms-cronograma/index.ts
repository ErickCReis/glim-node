import { router } from "@ms-cronograma/router";
import { createModule } from "glim-node";

export const mscronograma = await createModule("ms-cronograma", {
  db: "postgres",
  cache: "redis",
  storage: ["construcao"],
});

const hcWithType = mscronograma.loadRouter(router);
const client = hcWithType("http://localhost:3000/");
console.log(client.cronogramas.$url().href);

// Client test
// client.cronogramas
//   .$get(undefined, {
//     headers: { "x-auth": btoa(JSON.stringify({})) },
//   })
//   .then((r) => r.json())
//   .then((r) => console.log(r));
