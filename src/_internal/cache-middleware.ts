import type { FeatureDriverType } from "@core/_internal/features";
import { coreEnv, md5 } from "@core/helpers";

export async function invalidateCacheMiddleware<
  Client extends { $url: (arg: any) => URL; $get: (args: any) => any },
>(
  driver: FeatureDriverType<"cache">,
  client: Client,
  param: NonNullable<Parameters<Client["$url"]>[0]>["param"],
  userId = 0,
) {
  await invalidate(driver, userId, client.$url({ param }).pathname);
}

const NAMESPACE = "CACHE_MIDDLEWARE";

async function getKey(
  userId: number,
  req: {
    path: string;
    query?: Record<string, string>;
    body?: string;
  },
) {
  const queryString = Object.entries(req.query ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  return [userId, req.path, md5(queryString + (req.body ?? ""))].join(":");
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

async function invalidate(
  driver: FeatureDriverType<"cache">,
  userId: number,
  pattern: string,
) {
  const fullKey = `${NAMESPACE}:${userId}`;
  const regex = new RegExp(`${pattern.replaceAll("*", ".*")}:`);

  return driver.inDb(userId, async () => {
    const keys = await driver.hkeys(fullKey);

    const toDelete = keys.filter((key) => key.match(regex));
    if (toDelete.length) {
      await driver.hdel(fullKey, ...toDelete);
    }

    return true;
  });
}

export const cacheMiddleware = {
  getKey,
  read,
  write,
  invalidate,
};
