import { createApp } from "glim-node";
import { router } from "./router";

export const app = await createApp({
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

app.loadRouter(router);

const hcWithType = app.loadRouter(router);
export const client = hcWithType("http://localhost:3000");
