import { router } from "@ms-cronograma/router";
import { createModule } from "glim-node";

export const mscronograma = await createModule("ms-cronograma", {
  db: {
    default: "postgres",
  },
  cache: {
    default: "redis",
  },
  storage: {
    construcao: "s3",
  },
  http: {
    msAgenda: "webservice",
    msAgendaBifrost: "bifrost",
  },
  notification: {
    default: {
      driver: "sns",
      topics: ["criacao-cronograma"],
    },
  },
});

const hcWithType = mscronograma.loadRouter(router);
export const client = hcWithType("http://localhost:3000");
