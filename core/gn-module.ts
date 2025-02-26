import type { MiddlewareHandler } from "hono";
import type { z } from "zod";
import type { GnRouter } from "./gn-router.js";

export function createModule<TNamespace extends string>(namespace: TNamespace) {
  return <TEnv extends z.Schema = z.ZodNever>({
    env,
    ...rest
  }: {
    env: TEnv;
    router: GnRouter<TNamespace>;
    middleware: Array<MiddlewareHandler>;
  }) => {
    return {
      namespace,
      env: env.parse(process.env) as z.infer<TEnv>,
      ...rest,
    };
  };
}

export type GnModule<TNamespace extends string = string> = ReturnType<
  ReturnType<typeof createModule<TNamespace>>
>;
