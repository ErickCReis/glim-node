import type { Env, Hono, Schema } from "hono";
import type { BlankEnv, BlankSchema } from "hono/types";

export type BaseRouter<
  TNamespace extends string,
  TEnv extends Env = BlankEnv,
  TSchema extends Schema = BlankSchema
> = Hono<TEnv, TSchema, TNamespace>;

export function createRouter<TNamespace extends string = string>(
  namespace: TNamespace
) {
  return <TRouter extends BaseRouter<TNamespace>>(
    routes: (basePath: TNamespace) => TRouter
  ) => routes(namespace);
}

export type GnRouter<TNamespace extends string = string> = ReturnType<
  ReturnType<typeof createRouter<TNamespace>>
>;
