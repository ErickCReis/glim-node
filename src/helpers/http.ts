import { ensureTrailingSlash, formatEnvKey } from "@core/helpers/utils";
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

export function getHttpEnv(namespace?: string, alias = "default") {
  const key = formatEnvKey("HTTP", namespace, alias);

  const httpEnv = z
    .object({
      [`${key}_URL`]: z.string().nonempty().transform(ensureTrailingSlash),
      [`${key}_TIMEOUT`]: z.coerce.number().default(5000),
    })
    .parse(process.env);

  const baseUrl = httpEnv[`${key}_URL`] as string;
  const timeout = httpEnv[`${key}_TIMEOUT`] as number;
  return { baseUrl, timeout };
}
