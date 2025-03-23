import { type FeatureReturn, createFeature } from "@core/_internal/features";
import { cacheRequest, coreEnv, time } from "@core/helpers";
import type { Auth } from "@core/middleware/auth-middleware";
import { createMiddleware } from "hono/factory";

const CACHE_MIDDLEWARE_HEADER = "x-cache-middleware";

type Context = {
  Variables: { driver: FeatureReturn<"cache.redis"> | undefined };
};

export async function cacheDriverMiddleware() {
  if (!coreEnv.CACHE_MIDDLEWARE) {
    return createMiddleware<Context>((_, next) => next());
  }

  const driver = await createFeature(
    "cache.redis",
    {},
    // @ts-expect-error
    { namespace: "middleware" },
    "default",
  );
  return createMiddleware<Context>(async (c, next) => {
    c.set("driver", driver);
    await next();
  });
}

export function cacheMiddleware(ttl = time.untilEndOfDay()) {
  return _cacheMiddleware({ ttl });
}

export function cacheMiddlewareByUser(ttl = time.untilEndOfDay()) {
  return _cacheMiddleware({ ttl, byUser: true });
}

function _cacheMiddleware<ByUser extends boolean = false>({
  ttl,
  byUser,
}: {
  ttl: number;
  byUser?: ByUser;
}) {
  return createMiddleware<{
    Variables: {
      driver: FeatureReturn<"cache.redis">;
    } & (ByUser extends true
      ? {
          auth: Auth;
        }
      : Record<string, never>);
  }>(async (c, next) => {
    if (!coreEnv.CACHE_MIDDLEWARE) {
      return next();
    }

    if (c.req.method !== "GET") {
      return next();
    }

    const auth = c.var.auth;
    if (byUser && !auth) {
      throw new Error(
        "Não é possível usar cacheMiddlewareByUser sem autenticação.",
      );
    }

    const userId = byUser ? auth.id : 0;

    const driver = c.var.driver;
    const key = await cacheRequest.getKey(userId, c.req.raw);

    const cached = await cacheRequest.read(driver, key);
    if (cached) {
      c.header(CACHE_MIDDLEWARE_HEADER, "true");
      return c.json(cached);
    }

    await next();

    if (c.error) {
      return;
    }

    const isJson = c.res.headers
      .get("content-type")
      ?.includes("application/json");
    if (!isJson) {
      return;
    }

    const expiration = time.now() + ttl;
    const data = JSON.stringify(await c.res.json());

    await cacheRequest.write(driver, key, expiration, data);

    c.res.headers.set(CACHE_MIDDLEWARE_HEADER, "false");
    c.res = new Response(data, {
      headers: c.res.headers,
      status: c.res.status,
    });
  });
}
