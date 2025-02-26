import { cors } from "hono/cors";

export const corsMiddleware = cors({
  origin: "*", //env('APP_CORS_ORIGIN', '*'))
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

// header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
// header("Cache-Control: post-check=0, pre-check=0");
// header("Pragma: no-cache");
