import { type FeatureDriverType, createDriver } from "@core/_internal/features";
import { coreEnv } from "@core/helpers";
import type { Auth } from "@core/middleware/auth-middleware";
import type { HonoRequest } from "hono";
import { createMiddleware } from "hono/factory";

const CACHE_MIDDLEWARE_HEADER = "x-cache-middleware";
const NAMESPACE = "CACHE_MIDDLEWARE";

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
    const key = await getKey(c.req, userId);

    const cached = await read(driver, key);
    if (cached) {
      c.header(CACHE_MIDDLEWARE_HEADER, "true");
      return c.json(cached);
    }

    await next();

    const expiration =
      Math.round(Date.now() / 1000) + (ttl === "endOfDay" ? 86400 : ttl);
    const data = JSON.stringify(await c.res.json());

    await write(driver, key, expiration, data);

    c.res.headers.set(CACHE_MIDDLEWARE_HEADER, "false");
    c.res = new Response(data, {
      headers: c.res.headers,
      status: c.res.status,
    });
  });
}

async function getKey(req: HonoRequest, userId: number) {
  const queryString = Object.entries(req.query())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  let bodyString = "";
  try {
    bodyString = JSON.stringify(await req.json());
  } catch (_) {}

  return [userId, req.path, `(${queryString + bodyString})`].join(":");
}

async function read(driver: FeatureDriverType<"cache">, key: string) {
  const [userId, path, extra] = key.split(":");
  if (!userId || !path || !extra) {
    return false;
  }

  const fullKey = `${NAMESPACE}:${userId}`;
  const hash = `${path}:${extra}`;

  return driver.inDb(+userId, async () => {
    const value = await driver.hget(fullKey, hash);
    if (!value) {
      return false;
    }

    const [expiration, data] = value.split("|");
    if (!expiration || !data) {
      return false;
    }

    if (+expiration < Date.now() / 1000) {
      await driver.hdel(fullKey, hash);
      return false;
    }

    return JSON.parse(data);
  });
}

async function write(
  driver: FeatureDriverType<"cache">,
  key: string,
  expiration: number,
  data: string,
) {
  const [userId, path, extra] = key.split(":");
  if (!userId || !path || !extra) {
    return false;
  }

  const fullKey = `${NAMESPACE}:${userId}`;
  const hash = `${path}:${extra}`;

  return driver.inDb(+userId, async () => {
    await driver.hset(fullKey, hash, `${expiration}|${data}`);

    if (userId === "0") {
      const currentExpiration = await driver.expiretime(fullKey);
      if (currentExpiration <= 0) {
        await driver.expire(fullKey, 86400);
      }
    } else {
      await driver.expireat(
        fullKey,
        Math.round(Date.now() / 1000) + coreEnv.CACHE_MIDDLEWARE_KEY_EXPIRE,
      );
    }
    return true;
  });
}
