import type { FeatureDriverType } from "@core/_internal/features";
import { md5 } from "@core/helpers/crypto";
import { time } from "@core/helpers/time";

type Driver = FeatureDriverType<"cache"> | undefined;

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

  async read(driver: Driver, key: string) {
    if (!driver) {
      return false;
    }

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

  async write(driver: Driver, key: string, expiration: number, data: string) {
    if (!driver) {
      return false;
    }

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
          await driver.expire(fullKey, time.untilEndOfDay());
        }
      } else {
        await driver.expireat(fullKey, time.now() + time("1d"));
      }
      return true;
    });
  },

  async invalidate(driver: Driver, ...patterns: URL[]) {
    return _invalidate(driver, 0, patterns);
  },

  async invalidateByUser(driver: Driver, userId: number, ...patterns: URL[]) {
    return _invalidate(driver, userId, patterns);
  },
};

async function _invalidate(driver: Driver, userId: number, patterns: URL[]) {
  if (!driver || patterns.length === 0) {
    return;
  }

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
  });
}
