import { z } from "zod";

const appEnvOptions = [
  "local",
  "development",
  "staging",
  "production",
] as const;

const appEnvOptionsMap = {
  production: "PRD",
  staging: "STG",
  development: "DEV",
  local: "DEV",
} as const satisfies Record<(typeof appEnvOptions)[number], string>;

export const coreEnv = z
  .object({
    APP_NAME: z.string(),
    APP_ENV: z
      .enum(["local", "development", "staging", "production"])
      .transform((v) => appEnvOptionsMap[v]),
    APP_CORS_ORIGIN: z.string().optional().default("*"),

    APP_CLIENT_KEY: z.string(),
    APP_BIFROST_KEY: z.string(),

    CACHE_MIDDLEWARE: z.coerce.boolean().default(false),
    CACHE_MIDDLEWARE_KEY_EXPIRE: z.coerce.number().default(86400),
  })
  .parse(process.env);
