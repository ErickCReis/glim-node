import type { FeatureDriverType } from "@core/_internal/features";
import { coreEnv, md5 } from "@core/helpers";

export async function invalidateCacheMiddleware<
  Client extends { $url: (arg: any) => URL; $get: any },
>(
  driver: FeatureDriverType<"cache">,
  client: Client,
  param: NonNullable<Parameters<Client["$url"]>[0]>["param"],
  userId = 0,
) {
  await _invalidate(driver, userId, [client.$url({ param })]);
}

export const cacheRequest = {
  NAMESPACE: "CACHE_REQUEST",

  async getKey(userId: number, req: Request) {
    const clone = new Request(req);
    const url = new URL(clone.url);

    url.searchParams.sort();
    const queryString = url.searchParams.toString();

    const bodyString = await clone
      .json()
      .then(JSON.stringify)
      .catch(() => "");

    return [userId, url.pathname, md5(queryString + bodyString)].join(":");
  },

  async read(driver: FeatureDriverType<"cache">, key: string) {
    const [userId, path, extra] = key.split(":");
    if (!userId || !path || !extra) {
      return false;
    }

    const fullKey = `${this.NAMESPACE}:${userId}`;
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
  },

  async write(
    driver: FeatureDriverType<"cache">,
    key: string,
    expiration: number,
    data: string,
  ) {
    const [userId, path, extra] = key.split(":");
    if (!userId || !path || !extra) {
      return false;
    }

    const fullKey = `${this.NAMESPACE}:${userId}`;
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
  },

  async invalidate(
    driver: FeatureDriverType<"cache">,
    ...patterns: [URL, ...URL[]]
  ) {
    return _invalidate(driver, 0, patterns);
  },

  async invalidateByUser(
    driver: FeatureDriverType<"cache">,
    userId: number,
    ...patterns: [URL, ...URL[]]
  ) {
    return _invalidate(driver, userId, patterns);
  },
};

async function _invalidate(
  driver: FeatureDriverType<"cache">,
  userId: number,
  patterns: [URL, ...URL[]],
) {
  const fullKey = `${cacheRequest.NAMESPACE}:${userId}`;
  const regex = patterns.map(
    (p) => new RegExp(`^${p.pathname.replaceAll("*", ".*")}:`),
  );

  return driver.inDb(userId, async () => {
    const keys = await driver.hkeys(fullKey);
    const toDelete = keys.filter((key) => regex.some((r) => key.match(r)));
    if (toDelete.length) {
      await driver.hdel(fullKey, ...toDelete);
    }

    return true;
  });
}
