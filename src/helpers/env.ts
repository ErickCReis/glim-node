import { z } from "zod";

const appEnvOptions = ["local", "development", "staging", "production"] as const;

const appEnvOptionsMap = {
  production: "PRD",
  staging: "STG",
  development: "DEV",
  local: "DEV",
} as const satisfies Record<(typeof appEnvOptions)[number], string>;

const coreEnvSchema = z.object({
  APP_NAME: z.string(),
  APP_ENV: z
    .enum(["local", "development", "staging", "production"])
    .transform((v) => appEnvOptionsMap[v]),
  APP_CORS_ORIGIN: z.string().optional().default("*"),

  CACHE_MIDDLEWARE: z.coerce.boolean().default(false),
  CACHE_MIDDLEWARE_KEY_EXPIRE: z.coerce.number().default(86400),
});

export type CoreEnv = z.infer<typeof coreEnvSchema>;

export function getCoreEnv(): CoreEnv {
  return coreEnvSchema.parse(process.env);
}

export const coreEnv = new Proxy({} as CoreEnv, {
  get(_target, prop) {
    return getCoreEnv()[prop as keyof CoreEnv];
  },
  has(_target, prop) {
    return prop in getCoreEnv();
  },
  ownKeys() {
    return Reflect.ownKeys(getCoreEnv());
  },
  getOwnPropertyDescriptor() {
    return {
      enumerable: true,
      configurable: true,
    };
  },
});
