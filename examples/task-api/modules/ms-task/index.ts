import { router } from "@ms-task/router";
import { createModule } from "glim-node";

export const mstask = await createModule("ms-task", {
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
    config: { topics: ["criacao-task"] },
  },
  httpMsStatistic: {
    type: "http.webservice",
  },
});

const hcWithType = mstask.loadRouter(router);
export const client = hcWithType("http://localhost:3000");
