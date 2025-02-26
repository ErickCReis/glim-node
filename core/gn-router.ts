import type { Env, Hono, Schema } from "hono";
import type { BlankEnv, BlankSchema } from "hono/types";

export type BaseRouter<
  TNamespace extends string,
  TVersion extends number,
  TEnv extends Env = BlankEnv,
  TSchema extends Schema = BlankSchema,
> = Hono<TEnv, TSchema, `${TNamespace}/v${TVersion}`>;

export function createRouter<TNamespace extends string = string>(
  namespace: TNamespace,
) {
  return <
    TRouterV1 extends BaseRouter<TNamespace, 1>,
    TRouterV2 extends BaseRouter<TNamespace, 2>,
    TRouterV3 extends BaseRouter<TNamespace, 3>,
  >(routes: {
    v1?: (basePath: `${TNamespace}/v1`) => TRouterV1;
    v2?: (basePath: `${TNamespace}/v2`) => TRouterV2;
    v3?: (basePath: `${TNamespace}/v3`) => TRouterV3;
  }) => ({
    v1: routes.v1?.(`${namespace}/v1`),
    v2: routes.v2?.(`${namespace}/v2`),
    v3: routes.v3?.(`${namespace}/v3`),
  });
}

export type GnRouter<TNamespace extends string = string> = ReturnType<
  ReturnType<typeof createRouter<TNamespace>>
>;
