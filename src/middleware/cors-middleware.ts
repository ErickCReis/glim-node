import { coreEnv } from "@core/helpers/env.js";
import { cors } from "hono/cors";

export const corsMiddleware = cors({
  origin: coreEnv.APP_CORS_ORIGIN,
  allowHeaders: [
    "Accept",
    "Content-Type",
    "Origin",
    "X-Requested-With",
    "Authorization",
    "x-auth",
    "x-client",
    "x-crypt",
    "x-time",
    "x-bifrost",
    "x-grace",
    "trace-id",
  ],
  allowMethods: ["OPTIONS", "GET", "POST", "PUT", "PATCH", "DELETE"],
  credentials: true,
  exposeHeaders: [],
});
