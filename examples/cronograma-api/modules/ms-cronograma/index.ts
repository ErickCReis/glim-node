import { router } from "@ms-cronograma/router";
import { createModule } from "glim-node";

export const mscronograma = await createModule("ms-cronograma", {
  db: {
    type: "db.postgres",
  },
  cache: {
    type: "cache.redis",
  },
  storageConstrucao: {
    type: "storage.s3",
  },
  notification: {
    type: "notification.sns",
    config: { topics: ["criacao-cronograma"] },
  },
  httpMsAgenda: {
    type: "http.webservice",
  },
  httpMsAgendaBifrost: {
    type: "http.bifrost",
  },
});

const hcWithType = mscronograma.loadRouter(router);
export const client = hcWithType("http://localhost:3000");
