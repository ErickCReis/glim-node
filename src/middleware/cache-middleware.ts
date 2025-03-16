import { cacheMiddleware as helper } from "@core/_internal/cache-middleware";
import { type FeatureDriverType, createDriver } from "@core/_internal/features";
import { coreEnv } from "@core/helpers";
import type { Auth } from "@core/middleware/auth-middleware";
import { createMiddleware } from "hono/factory";

const CACHE_MIDDLEWARE_HEADER = "x-cache-middleware";

export async function cacheDriverMiddleware() {
  if (!coreEnv.CACHE_MIDDLEWARE) {
    return createMiddleware((_, next) => next());
  }

  const driver = await createDriver("cache", "redis", "middleware");
  return createMiddleware<{
    Variables: { driver: FeatureDriverType<"cache"> };
  }>(async (c, next) => {
    c.set("driver", driver);
    await next();
  });
}

export function cacheMiddleware(ttl: number | "endOfDay" = "endOfDay") {
  return _cacheMiddleware({ ttl });
}

export function cacheMiddlewareByUser(ttl: number | "endOfDay" = "endOfDay") {
  return _cacheMiddleware({ ttl, byUser: true });
}

function _cacheMiddleware<ByUser extends boolean = false>({
  ttl = "endOfDay",
  byUser,
}: {
  ttl?: number | "endOfDay";
  byUser?: ByUser;
}) {
  return createMiddleware<{
    Variables: {
      driver: FeatureDriverType<"cache">;
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
      throw new Error("Cache middleware by user must have auth");
    }

    const userId = byUser ? auth.id : 0;

    const driver = c.var.driver;
    const key = await helper.getKey(userId, {
      path: c.req.path,
      query: c.req.query(),
      body: await c.req
        .json()
        .then(JSON.stringify)
        .catch(() => ""),
    });

    const cached = await helper.read(driver, key);
    if (cached) {
      c.header(CACHE_MIDDLEWARE_HEADER, "true");
      return c.json(cached);
    }

    await next();

    const expiration =
      Math.round(Date.now() / 1000) + (ttl === "endOfDay" ? 86400 : ttl);
    const data = JSON.stringify(await c.res.json().catch(() => ({})));

    await helper.write(driver, key, expiration, data);

    c.res.headers.set(CACHE_MIDDLEWARE_HEADER, "false");
    c.res = new Response(data, {
      headers: c.res.headers,
      status: c.res.status,
    });
  });
}
