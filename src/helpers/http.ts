import { sha1 } from "@core/helpers/crypto";
import { coreEnv } from "@core/helpers/env";
import { time as timeHelper } from "@core/helpers/time";
import type { Prettify } from "@core/helpers/types";
import { z } from "zod";

type Method = "GET" | "POST" | "PUT" | "DELETE";
type Options = {
  path: string;
  headers?: Record<string, string>;
  body?: any;
};

type BaseOptions = {
  baseUrl: string;
  timeout: number;
  globalHeaders?: () => Record<string, string>;
};

export function createBifrostClient(
  options: Prettify<BaseOptions & { getAuth: () => string }>,
) {
  return createHttpClient({
    ...options,
    globalHeaders: () => {
      const auth = options.getAuth();
      return {
        ..._bifrostHeaders(auth),
        ...options.globalHeaders?.(),
      };
    },
  });
}

export function createHttpClient({
  baseUrl,
  timeout,
  globalHeaders,
}: BaseOptions) {
  async function _request(method: Method, options: Options) {
    return fetch(`${baseUrl}${options.path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...globalHeaders?.(),
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(timeout),
    });
  }

  return {
    get: (options: Options) => _request("GET", options),
    post: (options: Options) => _request("POST", options),
    put: (options: Options) => _request("PUT", options),
    delete: (options: Options) => _request("DELETE", options),
  };
}

export function getHttpEnv(namespace: string, alias = "default") {
  const aliasWithoutPrefix = alias
    .toLocaleLowerCase()
    .replaceAll(/http[-_]?/g, "");

  const key = (
    alias === "default"
      ? `HTTP_${namespace}`
      : `HTTP_${namespace}_${aliasWithoutPrefix}`
  )
    .toUpperCase()
    .replaceAll("-", "_");

  const httpEnv = z
    .object({
      [`${key}_URL`]: z
        .string()
        .nonempty()
        .transform((v) => (v.endsWith("/") ? v : `${v}/`)),
      [`${key}_TIMEOUT`]: z.coerce.number().default(5000),
    })
    .parse(process.env);

  const baseUrl = httpEnv[`${key}_URL`] as string;
  const timeout = httpEnv[`${key}_TIMEOUT`] as number;
  return { baseUrl, timeout };
}

function _bifrostHeaders(auth: string) {
  const time = timeHelper.now({ out: "s" }).toString();
  const client = coreEnv.APP_CLIENT_KEY;
  const key = coreEnv.APP_BIFROST_KEY;

  return {
    "x-time": time,
    "x-client": client,
    "x-auth": auth,
    "x-bifrost": sha1(`${auth}.${client}.${time}.${key}`),
  };
}
