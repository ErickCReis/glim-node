import { ensureTrailingSlash, formatEnvKey } from "@core/helpers/utils";
import { z } from "zod";

type Method = "GET" | "POST" | "PUT" | "DELETE";
export type HttpRequestOptions = {
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
};

export type HttpClientConfig = {
  baseUrl: string;
  timeout: number;
  globalHeaders?: () => Record<string, string>;
};

export type HttpClient = {
  get: (options: HttpRequestOptions) => Promise<Response>;
  post: (options: HttpRequestOptions) => Promise<Response>;
  put: (options: HttpRequestOptions) => Promise<Response>;
  delete: (options: HttpRequestOptions) => Promise<Response>;
};

export type HttpEnv = Pick<HttpClientConfig, "baseUrl" | "timeout">;

export function createHttpClient({
  baseUrl,
  timeout,
  globalHeaders,
}: HttpClientConfig): HttpClient {
  async function _request(method: Method, options: HttpRequestOptions): Promise<Response> {
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
    get: (options: HttpRequestOptions) => _request("GET", options),
    post: (options: HttpRequestOptions) => _request("POST", options),
    put: (options: HttpRequestOptions) => _request("PUT", options),
    delete: (options: HttpRequestOptions) => _request("DELETE", options),
  };
}

export function getHttpEnv(namespace?: string, alias = "default"): HttpEnv {
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
